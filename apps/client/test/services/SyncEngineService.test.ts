/**
 * @jest-environment node
 */
const mockShowNotification = jest.fn();
jest.mock('../../src/state/notificationStore', () => ({
  useNotificationStore: { getState: () => ({ showNotification: mockShowNotification }) },
}));

// Media reconciliation runs at the end of every cycle and transfers bytes outside Axios;
// here all that matters is that it does not interfere with what the metadata cycle did.
const mockSyncStoryMedia = jest.fn(async () => ({
  uploaded: 0,
  downloaded: 0,
  failed: 0,
  offline: false,
}));
jest.mock('../../src/services/MediaSyncService', () => ({
  createMediaSyncService: () => ({ syncStoryMedia: mockSyncStoryMedia }),
}));

import axios from 'axios';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { MAX_SYNC_BATCH_SIZE } from '@keres/shared';
import {
  OFFLINE_RETRY_MS,
  SYNC_INTERVAL_MS,
  SyncEngineService,
} from '../../src/services/SyncEngineService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const SERVER = { id: 'server-1', url: 'http://servidor' };
const NOW = new Date('2026-08-10T12:00:00.000Z');
const base = { createdAt: NOW, updatedAt: NOW, version: 1, isDeleted: false };

let database: TestDatabase;
let engine: SyncEngineService;

/** Requests seen by the adapter, to assert what the engine sent (and what it did not). */
interface SeenRequest {
  method: string;
  url: string;
  body: any;
}
let seen: SeenRequest[];

/** Resposta do pull; cada teste ajusta o que o servidor "tem". */
let pullResponse: {
  updates: any[];
  publicFavorites?: any[];
  serverMaxOperationVersion: number;
  role: string;
};
/** Resposta do push. */
let pushResponse: any;
/** When set, the adapter fails as if the server were down. */
let offlineOn: 'pull' | 'push' | null;
/** When true, a push is acknowledged for every operation in the request body. */
let echoPushApplied: boolean;

/**
 * Axios resolves the adapter at request time and falls back to `axios.defaults.adapter` when the
 * instance has none of its own - and `createKeresAxiosInstance()` never sets one. That is what
 * allows intercepting the engine's private client without mocking the module or opening a seam in the
 * service. Its interceptors carry on running normally.
 */
function installAdapter() {
  seen = [];
  (axios.defaults as any).adapter = async (config: any) => {
    const url = `${config.url}`;
    const method = (config.method || 'get').toUpperCase();
    const body = config.data ? JSON.parse(config.data) : undefined;
    seen.push({ method, url, body });

    const isPull = url.includes('/pull');
    if (
      (isPull && offlineOn === 'pull') ||
      (!isPull && method === 'POST' && offlineOn === 'push')
    ) {
      const error: any = new Error('Network Error');
      error.code = 'ERR_NETWORK';
      error.config = config;
      error.request = {};
      throw error;
    }

    let data = isPull ? pullResponse : method === 'POST' ? pushResponse : {};
    if (!isPull && method === 'POST' && echoPushApplied && Array.isArray(body)) {
      data = {
        ...pushResponse,
        processedUpdates: body.length,
        applied: body.map((update: { clientOperationId?: string; entity: string; id: string }) => ({
          clientOperationId: update.clientOperationId,
          operationVersion: 1,
          entity: update.entity,
          entityId: update.id,
        })),
        conflicts: [],
      };
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
}

async function seedStory(overrides: Partial<typeof schema.stories.$inferInsert> = {}) {
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'server-user',
    title: 'A Queda',
    type: 'linear',
    serverId: SERVER.id,
    myRole: 'owner',
    ...base,
    ...overrides,
  });
}

async function seedServer() {
  await database.db.insert(schema.servers).values({
    id: SERVER.id,
    idUser: 'server-user',
    userName: 'ana',
    name: 'Casa',
    url: SERVER.url,
    ...base,
  });
}

async function seedPendingOperation(
  overrides: Partial<typeof schema.operationLogs.$inferInsert> = {},
) {
  const row = {
    id: `op-${Math.random().toString(36).slice(2)}`,
    storyId: STORY_ID,
    userId: 'server-user',
    operationVersion: 1,
    operationType: 'create' as const,
    entityType: 'Character',
    entityId: 'char-local',
    payload: JSON.stringify({ id: 'char-local', storyId: STORY_ID, name: 'Nyx', version: 1 }),
    createdAt: NOW,
    isSynced: false,
    serverOperationVersion: 0,
    ...overrides,
  };
  await database.db.insert(schema.operationLogs).values(row);
  return row;
}

/** A remote character-creation operation, in the shape the pull delivers. */
const remoteCreate = (id: string, name: string, operationVersion: number) => ({
  type: 'create',
  entity: 'Character',
  id,
  operationVersion,
  operationId: `srv-${operationVersion}`,
  data: {
    id,
    storyId: STORY_ID,
    name,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    version: 1,
    isDeleted: false,
    deletedAt: null,
  },
});

const readStory = () =>
  database.db.query.stories.findFirst({ where: eq(schema.stories.id, STORY_ID) });

/**
 * A single synchronization cycle, without timers. The return value is the "server unreachable" signal
 * that `startSync` uses to choose between the normal cadence and the fast-retry one.
 */
async function runOneCycle(): Promise<boolean> {
  return (engine as any).performSync();
}

beforeEach(async () => {
  database = await createTestDatabase();
  pullResponse = { updates: [], publicFavorites: [], serverMaxOperationVersion: 0, role: 'owner' };
  pushResponse = {
    message: 'ok',
    processedUpdates: 0,
    serverMaxOperationVersion: 0,
    applied: [],
    conflicts: [],
  };
  offlineOn = null;
  echoPushApplied = false;
  installAdapter();

  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockShowNotification.mockClear();
  mockSyncStoryMedia.mockClear();

  engine = SyncEngineService.getInstance();
  engine.setDbInstance(database.db);
  await seedServer();
  await engine.configure(STORY_ID, { ...SERVER, idUser: 'server-user' } as never);
});

afterEach(async () => {
  engine.stopSync();
  await engine.configure(undefined, null);
  delete (axios.defaults as any).adapter;
  database.close();
  jest.restoreAllMocks();
});

describe('pull', () => {
  it('asks the server only for what it has not seen yet', async () => {
    await seedStory({ lastServerSyncedLog: 7, lastPublicFavoriteLog: 3 });

    await runOneCycle();

    expect(seen[0].url).toContain('lastOperationVersion=7');
    expect(seen[0].url).toContain('lastPublicFavoriteVersion=3');
  });

  it('writes a remote creation into the local database', async () => {
    await seedStory();
    pullResponse = {
      updates: [remoteCreate('char-remoto', 'Keres', 5)],
      serverMaxOperationVersion: 5,
      role: 'owner',
    };

    await runOneCycle();

    const character = await database.db.query.characters.findFirst({
      where: eq(schema.characters.id, 'char-remoto'),
    });
    expect(character).toMatchObject({ name: 'Keres', storyId: STORY_ID });
  });

  /** An unknown operation must block the cursor: advancing past it would lose that remote edit forever. */
  it('does not advance the pull cursor past an entity type this client cannot apply yet', async () => {
    await seedStory();
    pullResponse = {
      updates: [{ ...remoteCreate('future-1', 'From a newer client', 8), entity: 'FutureEntity' }],
      serverMaxOperationVersion: 8,
      role: 'owner',
    };

    await runOneCycle();

    expect((await readStory())!.lastServerSyncedLog).toBe(0);
    expect(mockShowNotification).not.toHaveBeenCalledWith(
      expect.stringContaining('updates received'),
      'info',
    );
  });

  /** A partial reorder is unsafe to apply: it has to remain on the server for a later, valid retry. */
  it('does not move the cursor past a reorder without its complete item list', async () => {
    await seedStory();
    pullResponse = {
      updates: [
        {
          type: 'reorder',
          entity: 'Chapter',
          id: 'chapter-1',
          operationId: 'srv-reorder-7',
          operationVersion: 7,
          operationTime: NOW.toISOString(),
          reorderItems: [],
        },
      ],
      serverMaxOperationVersion: 7,
      role: 'owner',
    };

    await runOneCycle();

    expect((await readStory())!.lastServerSyncedLog).toBe(0);
  });

  it('imports a changed public favorite snapshot and announces it to its target entity', async () => {
    await seedStory();
    const emit = jest.spyOn(entityEventEmitter, 'emit');
    pullResponse = {
      updates: [],
      publicFavorites: [
        {
          id: 'favorite-remote',
          storyId: STORY_ID,
          entityId: 'character-remote',
          entityType: 'Character',
          userId: 'other-user',
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          version: 3,
          isDeleted: false,
          deletedAt: null,
        },
      ],
      serverMaxOperationVersion: 0,
      role: 'owner',
    };

    await runOneCycle();

    expect(
      await database.db.query.favorites.findFirst({
        where: eq(schema.favorites.id, 'favorite-remote'),
      }),
    ).toMatchObject({
      entityId: 'character-remote',
      userId: 'other-user',
      version: 3,
    });
    expect(emit).toHaveBeenCalledWith(
      'favorite_changed',
      STORY_ID,
      'Character',
      'character-remote',
      'other-user',
    );
    expect(emit).toHaveBeenCalledWith('character_changed', STORY_ID, 'character-remote');
  });

  it('does not redraw entities again when the public favorite snapshot has not changed', async () => {
    await seedStory();
    const favorite = {
      id: 'favorite-remote',
      storyId: STORY_ID,
      entityId: 'character-remote',
      entityType: 'Character',
      userId: 'other-user',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      version: 3,
      isDeleted: false,
      deletedAt: null,
    };
    pullResponse = {
      updates: [],
      publicFavorites: [favorite],
      serverMaxOperationVersion: 0,
      role: 'owner',
    };
    await runOneCycle();
    const emit = jest.spyOn(entityEventEmitter, 'emit').mockClear();

    await runOneCycle();

    expect(emit).not.toHaveBeenCalledWith(
      'favorite_changed',
      STORY_ID,
      'Character',
      'character-remote',
      'other-user',
    );
  });

  it('keeps the cursor behind an invalid remote payload and shows one actionable error', async () => {
    await seedStory();
    pullResponse = {
      updates: [
        {
          ...remoteCreate('invalid-character', 'Keres', 5),
          data: { ...remoteCreate('invalid-character', 'Keres', 5).data, name: undefined },
        },
      ],
      serverMaxOperationVersion: 5,
      role: 'owner',
    };

    await runOneCycle();

    expect((await readStory())!.lastServerSyncedLog).toBe(0);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  /**
   * The cursor advances to the highest operation that actually arrived, never to the response's
   * `serverMaxOperationVersion`: the two are read in separate queries on the
   * server, and an operation written between them enters the maximum but not the list - trusting the
   * maximum would skip it forever.
   */
  it('advances the cursor only to the highest operation it actually received', async () => {
    await seedStory();
    pullResponse = {
      updates: [remoteCreate('char-remoto', 'Keres', 5)],
      serverMaxOperationVersion: 99,
      role: 'owner',
    };

    await runOneCycle();

    expect((await readStory())!.lastServerSyncedLog).toBe(5);
  });

  it('leaves the cursor where it was when the server sent nothing', async () => {
    await seedStory({ lastServerSyncedLog: 4 });
    pullResponse = { updates: [], serverMaxOperationVersion: 42, role: 'owner' };

    await runOneCycle();

    expect((await readStory())!.lastServerSyncedLog).toBe(4);
  });

  it('does not re-apply what it already has on a second cycle', async () => {
    await seedStory();
    pullResponse = {
      updates: [remoteCreate('char-remoto', 'Keres', 5)],
      serverMaxOperationVersion: 5,
      role: 'owner',
    };
    await runOneCycle();

    pullResponse = { updates: [], serverMaxOperationVersion: 5, role: 'owner' };
    await runOneCycle();

    const lastPull = seen.filter((request) => request.url.includes('/pull')).pop()!;
    expect(lastPull.url).toContain('lastOperationVersion=5');
  });

  it('caches the role the server reported', async () => {
    await seedStory({ myRole: 'owner' });
    pullResponse = { updates: [], serverMaxOperationVersion: 0, role: 'reader' };

    await runOneCycle();

    expect((await readStory())!.myRole).toBe('reader');
  });

  it('announces a role change, so open screens can lock editing', async () => {
    await seedStory({ myRole: 'writer' });
    pullResponse = { updates: [], serverMaxOperationVersion: 0, role: 'reader' };
    const listener = jest.fn();
    entityEventEmitter.on('story_role_changed', listener);

    await runOneCycle();
    entityEventEmitter.off('story_role_changed', listener);

    expect(listener).toHaveBeenCalledWith(STORY_ID);
  });

  it('stays quiet when the role did not change', async () => {
    await seedStory({ myRole: 'owner' });
    const listener = jest.fn();
    entityEventEmitter.on('story_role_changed', listener);

    await runOneCycle();
    entityEventEmitter.off('story_role_changed', listener);

    expect(listener).not.toHaveBeenCalled();
  });

  it('records when the server was last reached', async () => {
    await seedStory();

    await runOneCycle();

    const server = await database.db.query.servers.findFirst({
      where: eq(schema.servers.id, SERVER.id),
    });
    expect(server!.lastSyncDate).toBeInstanceOf(Date);
  });
});

/**
 * Before this fix, a remote reorder was always applied straight away, even with an unsent local
 * reordering on the same entity - and the reverse happened too
 * (the pending local reorder overwrote it back afterwards). It never became a `SyncConflict`,
 * so the person never found out they had lost their own reordering.
 */
describe('reconciling a remote reorder against pending local changes', () => {
  it('records a conflict instead of silently overwriting a pending local reorder', async () => {
    await seedStory();
    await seedPendingOperation({
      operationType: 'reorder',
      entityType: 'Chapter',
      entityId: 'chapter-1',
      payload: JSON.stringify({
        reorderItems: [
          { id: 'scene-a', newIndex: 1 },
          { id: 'scene-b', newIndex: 2 },
        ],
        version: 1,
      }),
    });
    await database.db.insert(schema.scenes).values([
      {
        id: 'scene-a',
        storyId: STORY_ID,
        chapterId: 'chapter-1',
        locationId: 'location-1',
        name: 'A',
        index: 2,
        ...base,
      },
      {
        id: 'scene-b',
        storyId: STORY_ID,
        chapterId: 'chapter-1',
        locationId: 'location-1',
        name: 'B',
        index: 1,
        ...base,
      },
    ]);
    pullResponse = {
      updates: [
        {
          type: 'reorder',
          entity: 'Chapter',
          id: 'chapter-1',
          operationVersion: 9,
          operationId: 'srv-9',
          operationTime: NOW.toISOString(),
          reorderItems: [
            { id: 'scene-b', newIndex: 1 },
            { id: 'scene-a', newIndex: 2 },
          ],
          version: 2,
        },
      ],
      serverMaxOperationVersion: 9,
      role: 'owner',
    };

    await runOneCycle();

    const conflicts = await database.db.query.syncConflicts.findMany({
      where: eq(schema.syncConflicts.storyId, STORY_ID),
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      entityType: 'Chapter',
      entityId: 'chapter-1',
      localOperationType: 'reorder',
      reason: 'concurrent_edit',
    });

    // The local order was not touched - it stays exactly as the user left it, awaiting
    // their decision on the conflict screen.
    const sceneA = await database.db.query.scenes.findFirst({
      where: eq(schema.scenes.id, 'scene-a'),
    });
    expect(sceneA!.index).toBe(2);
  });

  it('applies the remote reorder directly when nothing pending on that entity is a reorder', async () => {
    await seedStory();
    await database.db.insert(schema.chapters).values({
      id: 'chapter-1',
      storyId: STORY_ID,
      name: 'Capítulo 1',
      index: 1,
      ...base,
    });
    await seedPendingOperation({
      operationType: 'update',
      entityType: 'Chapter',
      entityId: 'chapter-1',
      payload: JSON.stringify({ name: 'Novo nome', version: 1 }),
    });
    await database.db.insert(schema.scenes).values({
      id: 'scene-a',
      storyId: STORY_ID,
      chapterId: 'chapter-1',
      locationId: 'location-1',
      name: 'A',
      index: 1,
      ...base,
    });
    pullResponse = {
      updates: [
        {
          type: 'reorder',
          entity: 'Chapter',
          id: 'chapter-1',
          operationVersion: 9,
          operationId: 'srv-9',
          operationTime: NOW.toISOString(),
          reorderItems: [{ id: 'scene-a', newIndex: 5 }],
          version: 2,
        },
      ],
      serverMaxOperationVersion: 9,
      role: 'owner',
    };

    await runOneCycle();

    const conflicts = await database.db.query.syncConflicts.findMany({
      where: eq(schema.syncConflicts.storyId, STORY_ID),
    });
    expect(conflicts).toEqual([]);

    const sceneA = await database.db.query.scenes.findFirst({
      where: eq(schema.scenes.id, 'scene-a'),
    });
    expect(sceneA!.index).toBe(5);
  });
});

describe('push', () => {
  it('sends the operations that were never synced', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation();

    await runOneCycle();

    const push = seen.find((request) => request.method === 'POST');
    expect(push).toBeDefined();
    expect(push!.body).toHaveLength(1);
    expect(push!.body[0]).toMatchObject({ type: 'create', entity: 'Character', id: 'char-local' });
  });

  it('splits a backlog larger than the server batch cap into multiple posts', async () => {
    await seedStory({ lastOperationLog: 250 });
    for (let index = 0; index < MAX_SYNC_BATCH_SIZE + 1; index += 1) {
      await seedPendingOperation({
        id: `op-batch-${index}`,
        operationVersion: index + 1,
        entityId: `char-${index}`,
        payload: JSON.stringify({
          id: `char-${index}`,
          storyId: STORY_ID,
          name: 'Nyx',
          version: 1,
        }),
      });
    }

    echoPushApplied = true;

    await runOneCycle();

    const posts = seen.filter((request) => request.method === 'POST');
    expect(posts.map((post) => post.body.length)).toEqual([MAX_SYNC_BATCH_SIZE, 1]);
  });

  it('does not push when there is nothing pending', async () => {
    await seedStory();

    await runOneCycle();

    expect(seen.filter((request) => request.method === 'POST')).toEqual([]);
  });

  it('does not push an operation that was already synced', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation({ isSynced: true });

    await runOneCycle();

    expect(seen.filter((request) => request.method === 'POST')).toEqual([]);
  });

  /**
   * An operation in conflict stays out of the push until the user decides. Without that it would be
   * resent and refused on every cycle, forever.
   */
  it.each(['conflicted', 'abandoned'] as const)(
    'does not push an operation marked %s',
    async (conflictState) => {
      await seedStory({ lastOperationLog: 1 });
      await seedPendingOperation({ conflictState });

      await runOneCycle();

      expect(seen.filter((request) => request.method === 'POST')).toEqual([]);
    },
  );

  it('marks an accepted operation as synced, so it is never sent twice', async () => {
    await seedStory({ lastOperationLog: 1 });
    const operation = await seedPendingOperation();
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 10,
      applied: [
        {
          clientOperationId: operation.id,
          operationVersion: 10,
          entityVersion: 1,
          entity: 'Character',
          entityId: 'char-local',
        },
      ],
      conflicts: [],
    };

    await runOneCycle();

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log.isSynced).toBe(true);
  });

  it('keeps an operation pending when the server was unreachable', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation();
    offlineOn = 'push';

    await runOneCycle();

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log.isSynced).toBe(false);
  });

  it('reports being offline, so the caller retries sooner', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation();
    offlineOn = 'push';

    await expect(runOneCycle()).resolves.toBe(true);
  });
});

/**
 * `version_conflict` only says that the client's base has gone stale, not that both sides
 * changed the same fields. `changedFields` (computed by the server from its own
 * operation history - see `SyncService.getChangedFieldsSinceVersion` in the API) is what
 * allows the client to merge silently when there is no real dispute, instead of always opening
 * a decision for the user.
 */
describe('push - auto-merging non-overlapping field conflicts', () => {
  async function seedLocalCharacter(
    overrides: Partial<typeof schema.characters.$inferInsert> = {},
  ) {
    await database.db.insert(schema.characters).values({
      id: 'char-local',
      storyId: STORY_ID,
      name: 'Nyx',
      title: 'Old Title',
      motivation: 'Old Motivation',
      ...base,
      ...overrides,
    });
  }

  const readCharacter = () =>
    database.db.query.characters.findFirst({ where: eq(schema.characters.id, 'char-local') });

  it('merges silently and rebases the pending operation when the server changed a different field', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedLocalCharacter();
    const operation = await seedPendingOperation({
      operationType: 'update',
      payload: JSON.stringify({ id: 'char-local', motivation: 'Nova Motivação', version: 1 }),
    });
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 5,
      applied: [],
      conflicts: [
        {
          entity: 'Character',
          entityId: 'char-local',
          type: 'update',
          reason: 'version_conflict',
          message: 'stale',
          clientVersion: 1,
          serverVersion: 2,
          serverEntity: {
            id: 'char-local',
            storyId: STORY_ID,
            name: 'Nyx',
            title: 'Título Novo do Servidor',
            motivation: 'Old Motivation',
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
            version: 2,
            isDeleted: false,
            deletedAt: null,
          },
          changedFields: ['title'],
        },
      ],
    };

    await runOneCycle();

    expect(await database.db.query.syncConflicts.findMany()).toEqual([]);
    expect(await readCharacter()).toMatchObject({
      title: 'Título Novo do Servidor',
      version: 2,
    });

    const log = await database.db.query.operationLogs.findFirst({
      where: eq(schema.operationLogs.id, operation.id),
    });
    expect(log!.isSynced).toBe(false);
    expect(log!.conflictState).toBeNull();
    // Rebased on the server's new version, ready to go in the next cycle without bothering the user.
    expect(JSON.parse(log!.payload).version).toBe(3);
  });

  /**
   * Regression: `changedFields` on its own only says "somebody else touched this", not "the value I
   * want to write differs from the one already there". Two people renaming to the same text (or
   * one resending an operation that had already gone) made the field show as disputed even
   * with nothing actually to decide - a two-button conflict that only reinforced an already
   * correct value.
   */
  it('merges silently even when the changed field coincidentally ends up with the same value', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedLocalCharacter();
    const operation = await seedPendingOperation({
      operationType: 'update',
      payload: JSON.stringify({ id: 'char-local', title: 'Título Novo do Servidor', version: 1 }),
    });
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 5,
      applied: [],
      conflicts: [
        {
          entity: 'Character',
          entityId: 'char-local',
          type: 'update',
          reason: 'version_conflict',
          message: 'stale',
          clientVersion: 1,
          serverVersion: 2,
          serverEntity: {
            id: 'char-local',
            storyId: STORY_ID,
            name: 'Nyx',
            title: 'Título Novo do Servidor',
            motivation: 'Old Motivation',
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
            version: 2,
            isDeleted: false,
            deletedAt: null,
          },
          changedFields: ['title'],
        },
      ],
    };

    await runOneCycle();

    expect(await database.db.query.syncConflicts.findMany()).toEqual([]);
    expect(await readCharacter()).toMatchObject({ title: 'Título Novo do Servidor', version: 2 });

    const log = await database.db.query.operationLogs.findFirst({
      where: eq(schema.operationLogs.id, operation.id),
    });
    expect(log!.isSynced).toBe(false);
    expect(log!.conflictState).toBeNull();
    expect(JSON.parse(log!.payload).version).toBe(3);
  });

  it('still opens a conflict when the same field was edited on both sides', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedLocalCharacter();
    await seedPendingOperation({
      operationType: 'update',
      payload: JSON.stringify({ id: 'char-local', motivation: 'Minha Motivação', version: 1 }),
    });
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 5,
      applied: [],
      conflicts: [
        {
          entity: 'Character',
          entityId: 'char-local',
          type: 'update',
          reason: 'version_conflict',
          message: 'stale',
          clientVersion: 1,
          serverVersion: 2,
          serverEntity: {
            id: 'char-local',
            storyId: STORY_ID,
            name: 'Nyx',
            title: 'Old Title',
            motivation: 'Motivação do Servidor',
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
            version: 2,
            isDeleted: false,
            deletedAt: null,
          },
          changedFields: ['motivation'],
        },
      ],
    };

    await runOneCycle();

    const conflicts = await database.db.query.syncConflicts.findMany();
    expect(conflicts).toHaveLength(1);
    expect((await readCharacter())!.motivation).toBe('Old Motivation');
  });

  it('does not auto-merge when the server response has no changedFields (older server)', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedLocalCharacter();
    await seedPendingOperation({
      operationType: 'update',
      payload: JSON.stringify({ id: 'char-local', motivation: 'Nova Motivação', version: 1 }),
    });
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 5,
      applied: [],
      conflicts: [
        {
          entity: 'Character',
          entityId: 'char-local',
          type: 'update',
          reason: 'version_conflict',
          message: 'stale',
          clientVersion: 1,
          serverVersion: 2,
          serverEntity: {
            id: 'char-local',
            storyId: STORY_ID,
            name: 'Nyx',
            title: 'Título Novo do Servidor',
            motivation: 'Old Motivation',
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
            version: 2,
            isDeleted: false,
            deletedAt: null,
          },
          // sem changedFields
        },
      ],
    };

    await runOneCycle();

    expect(await database.db.query.syncConflicts.findMany()).toHaveLength(1);
    expect((await readCharacter())!.title).toBe('Old Title');
  });

  it('always opens a conflict for a deletion on the server, never auto-merges', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedLocalCharacter();
    await seedPendingOperation({
      operationType: 'update',
      payload: JSON.stringify({ id: 'char-local', title: 'Título Novo', version: 1 }),
    });
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 5,
      applied: [],
      conflicts: [
        {
          entity: 'Character',
          entityId: 'char-local',
          type: 'update',
          reason: 'deleted_on_server',
          message: 'deleted',
          clientVersion: 1,
          serverVersion: 2,
          serverEntity: { id: 'char-local', storyId: STORY_ID, isDeleted: true, version: 2 },
          changedFields: ['isDeleted'],
        },
      ],
    };

    await runOneCycle();

    expect(await database.db.query.syncConflicts.findMany()).toHaveLength(1);
  });
});

describe('when the server cannot be reached', () => {
  it('does not move the cursor', async () => {
    await seedStory({ lastServerSyncedLog: 4 });
    offlineOn = 'pull';

    await runOneCycle().catch(() => {});

    expect((await readStory())!.lastServerSyncedLog).toBe(4);
  });

  it('does not bother the user with a notification', async () => {
    await seedStory();
    offlineOn = 'pull';

    await runOneCycle().catch(() => {});

    expect(mockShowNotification).not.toHaveBeenCalled();
  });
});

describe('guards before a cycle runs', () => {
  it('does nothing without a story', async () => {
    await engine.configure(undefined, { ...SERVER, idUser: 'server-user' } as never);

    await expect(runOneCycle()).resolves.toBe(false);
    expect(seen).toEqual([]);
  });

  it('does nothing when the story is not in the local database', async () => {
    await expect(runOneCycle()).resolves.toBe(false);
    expect(seen.filter((request) => request.method === 'POST')).toEqual([]);
  });

  it('stops before reaching the network when a story is configured without a server URL', async () => {
    (engine as any).storyId = STORY_ID;
    (engine as any).client.defaults.baseURL = undefined;

    await expect(runOneCycle()).resolves.toBe(false);
    expect((engine as any).storyId).toBeNull();
    expect(seen).toEqual([]);
  });

  it('stops before reaching the network when its local database was cleared', async () => {
    (engine as any)._db = null;

    await expect(runOneCycle()).resolves.toBe(false);
    expect((engine as any).storyId).toBeNull();
    expect(seen).toEqual([]);
  });
});

describe('engine control surface', () => {
  it('forwards an explicit sync request to the scheduler', () => {
    const request = jest.spyOn((engine as any).scheduler, 'request');

    engine.requestSync('local-change');

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('reset clears every connection-bound dependency so a later story cannot inherit it', async () => {
    const resetScheduler = jest
      .spyOn((engine as any).scheduler, 'reset')
      .mockResolvedValue(undefined);
    const resetMedia = jest.spyOn((engine as any).media, 'reset');

    await engine.reset();

    expect(resetScheduler).toHaveBeenCalledTimes(1);
    expect(resetMedia).toHaveBeenCalledTimes(1);
    expect((engine as any).storyId).toBeNull();
    expect((engine as any).activeServer).toBeNull();
    expect((engine as any)._db).toBeNull();
    expect((engine as any).client.defaults.baseURL).toBeUndefined();
  });
});

describe('startSync', () => {
  // `performSync` is already covered by this file's other describes; here all that matters is the
  // scheduling itself (it runs immediately, reschedules with the right cadence, does not duplicate the loop),
  // so it is mocked to isolate that from the whole real network/DB chain.
  let performSyncSpy: jest.SpyInstance;

  const flush = async () => {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  };

  beforeEach(() => {
    performSyncSpy = jest.spyOn(engine as any, 'performSync').mockResolvedValue(false);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs a cycle immediately, without waiting for the interval to elapse', async () => {
    engine.startSync();
    await flush();

    expect(performSyncSpy).toHaveBeenCalledTimes(1);
  });

  it('does not start a second cycle chain when already running', async () => {
    engine.startSync();
    engine.startSync();
    await flush();

    expect(performSyncSpy).toHaveBeenCalledTimes(1);
  });

  it('reschedules at the normal interval after an online cycle', async () => {
    engine.startSync();
    await flush();
    performSyncSpy.mockClear();

    jest.advanceTimersByTime(SYNC_INTERVAL_MS - 1);
    await flush();
    expect(performSyncSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await flush();
    expect(performSyncSpy).toHaveBeenCalledTimes(1);
  });

  it('reschedules sooner, at the offline retry interval, after an unreachable cycle', async () => {
    performSyncSpy.mockResolvedValue(true); // true = server was unreachable this cycle
    engine.startSync();
    await flush();
    performSyncSpy.mockClear();

    jest.advanceTimersByTime(OFFLINE_RETRY_MS - 1);
    await flush();
    expect(performSyncSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await flush();
    expect(performSyncSpy).toHaveBeenCalledTimes(1);
  });

  it('stops the chain for good once stopSync is called', async () => {
    engine.startSync();
    await flush();
    performSyncSpy.mockClear();

    engine.stopSync();
    jest.advanceTimersByTime(SYNC_INTERVAL_MS * 2);
    await flush();

    expect(performSyncSpy).not.toHaveBeenCalled();
  });
});

describe('media reconciliation', () => {
  it('runs after the metadata cycle, never before', async () => {
    await seedStory();

    await runOneCycle();

    expect(mockSyncStoryMedia).toHaveBeenCalledTimes(1);
  });

  it('does not fail the cycle when media sync blows up', async () => {
    await seedStory();
    mockSyncStoryMedia.mockRejectedValueOnce(new Error('disco cheio'));

    await expect(runOneCycle()).resolves.toBe(false);
  });
});
