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
import { MAX_SYNC_BATCH_SIZE, MAX_SYNC_PULL_BATCH } from '@keres/shared';
import { OFFLINE_RETRY_MS, SYNC_INTERVAL_MS } from '../../src/services/SyncEngineService';
import type { SyncCycleOutcome } from '../../src/services/sync/SyncScheduler';
import type { SyncEngineService } from '../../src/services/SyncEngineService';
import { createAppSyncEngine } from '../../src/services/sync/appSyncEngine';
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
/** More than one page is used only by pagination tests. */
let pullPages: (typeof pullResponse)[] | null;
let pullPageIndex: number;
/** Resposta do push. */
let pushResponse: any;
/** When set, the adapter fails as if the server were down. */
let offlineOn: 'pull' | 'push' | null;
/** A reachable server can still reject a request; that is not an offline retry. */
let serverFailureOn: 'pull' | 'push' | null;
/** When set, the adapter answers 404 as if the story had been deleted server-side. */
let storyGoneOn: 'pull' | 'push' | null;
/** When set, the adapter refuses the sync protocol version (HTTP 426) instead. */
let protocolMismatchOn: 'pull' | 'push' | null;
/** When true, a push is acknowledged for every operation in the request body. */
let echoPushApplied: boolean;
/** When set, the adapter throws a raw string instead of an Error, to exercise message fallbacks. */
let throwStringOn: 'pull' | 'push' | null;
/** When true, a push POST fails as if the request had been cancelled mid-flight. */
let abortPush: boolean;
/** When set and closed, pull responses wait until the gate opens. */
let pullGate: { opened: boolean; waiters: (() => void)[] } | null;

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
    if (
      (isPull && serverFailureOn === 'pull') ||
      (!isPull && method === 'POST' && serverFailureOn === 'push')
    ) {
      const error: any = new Error('Request failed with status code 500');
      error.config = config;
      error.request = {};
      error.response = { status: 500, data: { message: 'server error' }, config, headers: {} };
      throw error;
    }
    if (
      (isPull && storyGoneOn === 'pull') ||
      (!isPull && method === 'POST' && storyGoneOn === 'push')
    ) {
      const error: any = new Error('Request failed with status code 404');
      error.config = config;
      error.request = {};
      error.response = { status: 404, data: { message: 'Story not found.' }, config, headers: {} };
      throw error;
    }
    if (
      (isPull && protocolMismatchOn === 'pull') ||
      (!isPull && method === 'POST' && protocolMismatchOn === 'push')
    ) {
      const error: any = new Error('Request failed with status code 426');
      error.config = config;
      error.request = {};
      error.response = { status: 426, data: { message: 'update the app' }, config, headers: {} };
      throw error;
    }
    if (
      (isPull && throwStringOn === 'pull') ||
      (!isPull && method === 'POST' && throwStringOn === 'push')
    ) {
      throw 'boom' as unknown as Error;
    }
    if (!isPull && method === 'POST' && abortPush) {
      const error: any = new Error('canceled');
      error.name = 'AbortError';
      error.code = 'ERR_CANCELED';
      error.config = config;
      throw error;
    }
    if (isPull && pullGate && !pullGate.opened) {
      await new Promise<void>((resolve) => pullGate!.waiters.push(resolve));
    }

    let data = isPull
      ? (pullPages?.[pullPageIndex++] ?? pullResponse)
      : method === 'POST'
        ? pushResponse
        : {};
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
    entityId: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
    payload: JSON.stringify({
      id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
      storyId: STORY_ID,
      name: 'Nyx',
      version: 1,
    }),
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
 * A single synchronization cycle, without timers. The outcome drives the scheduler cadence:
 * 'offline' retries fast, 'failed' backs off, 'ok' keeps the normal interval.
 */
async function runOneCycle(): Promise<SyncCycleOutcome> {
  return (engine as any).performSync(new AbortController().signal);
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
  serverFailureOn = null;
  storyGoneOn = null;
  protocolMismatchOn = null;
  pullPages = null;
  pullPageIndex = 0;
  echoPushApplied = false;
  throwStringOn = null;
  abortPush = false;
  pullGate = null;
  installAdapter();

  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockShowNotification.mockClear();
  mockSyncStoryMedia.mockClear();

  engine = createAppSyncEngine();
  await engine.bindDatabase(database.db);
  await seedServer();
  await engine.activateStory(STORY_ID, { ...SERVER, idUser: 'server-user' } as never);
});

afterEach(async () => {
  await engine.deactivateStory();
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
      updates: [
        {
          ...remoteCreate('FUTURE1ZZZZZZZZZZZZZZZZZZZ', 'From a newer client', 8),
          entity: 'FutureEntity',
        },
      ],
      serverMaxOperationVersion: 8,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('failed');

    expect((await readStory())!.lastServerSyncedLog).toBe(0);
    expect(mockShowNotification).not.toHaveBeenCalledWith(
      expect.stringContaining('updates received'),
      'info',
    );
  });

  it('imports a changed public favorite snapshot and announces it to its target entity', async () => {
    await seedStory();
    const emit = jest.spyOn(entityEventEmitter, 'emit');
    pullResponse = {
      updates: [],
      publicFavorites: [
        {
          id: 'FAVORITEREMOTEZZZZZZZZZZZZ',
          storyId: STORY_ID,
          entityId: 'CHARACTERREMOTEZZZZZZZZZZZ',
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
        where: eq(schema.favorites.id, 'FAVORITEREMOTEZZZZZZZZZZZZ'),
      }),
    ).toMatchObject({
      entityId: 'CHARACTERREMOTEZZZZZZZZZZZ',
      userId: 'other-user',
      version: 3,
    });
    expect(emit).toHaveBeenCalledWith(
      'favorite_changed',
      STORY_ID,
      'Character',
      'CHARACTERREMOTEZZZZZZZZZZZ',
      'other-user',
    );
    expect(emit).toHaveBeenCalledWith('character_changed', STORY_ID, 'CHARACTERREMOTEZZZZZZZZZZZ');
  });

  it('does not redraw entities again when the public favorite snapshot has not changed', async () => {
    await seedStory();
    const favorite = {
      id: 'FAVORITEREMOTEZZZZZZZZZZZZ',
      storyId: STORY_ID,
      entityId: 'CHARACTERREMOTEZZZZZZZZZZZ',
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
      'CHARACTERREMOTEZZZZZZZZZZZ',
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

    await expect(runOneCycle()).resolves.toBe('failed');

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

  it('drains a remote backlog page by page before it starts pushing local work', async () => {
    await seedStory();
    const firstPage = Array.from({ length: MAX_SYNC_PULL_BATCH }, (_, index) =>
      remoteCreate(`page-one-${index}`, `Person ${index}`, index + 1),
    );
    pullPages = [
      {
        updates: firstPage,
        serverMaxOperationVersion: MAX_SYNC_PULL_BATCH + 1,
        role: 'owner',
      },
      {
        updates: [remoteCreate('page-two', 'Last person', MAX_SYNC_PULL_BATCH + 1)],
        serverMaxOperationVersion: MAX_SYNC_PULL_BATCH + 1,
        role: 'owner',
      },
    ];

    await runOneCycle();

    expect(seen.filter((request) => request.url.includes('/pull'))).toHaveLength(2);
    expect((await readStory())!.lastServerSyncedLog).toBe(MAX_SYNC_PULL_BATCH + 1);
    expect(await database.db.query.characters.findMany()).toHaveLength(MAX_SYNC_PULL_BATCH + 1);
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

describe('push', () => {
  it('sends the operations that were never synced', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation();

    await runOneCycle();

    const push = seen.find((request) => request.method === 'POST');
    expect(push).toBeDefined();
    expect(push!.body).toHaveLength(1);
    expect(push!.body[0]).toMatchObject({
      type: 'create',
      entity: 'Character',
      id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
    });
  });

  it('splits a backlog larger than the server batch cap into multiple posts', async () => {
    await seedStory({ lastOperationLog: 250 });
    for (let index = 0; index < MAX_SYNC_BATCH_SIZE + 1; index += 1) {
      await seedPendingOperation({
        id: `op-batch-${index}`,
        operationVersion: index + 1,
        entityId: `CHAR${index}`.padEnd(26, 'Z'),
        payload: JSON.stringify({
          id: `CHAR${index}`.padEnd(26, 'Z'),
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
          entityId: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
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

    await expect(runOneCycle()).resolves.toBe('offline');
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
      id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
      storyId: STORY_ID,
      name: 'Nyx',
      title: 'Old Title',
      motivation: 'Old Motivation',
      ...base,
      ...overrides,
    });
  }

  const readCharacter = () =>
    database.db.query.characters.findFirst({
      where: eq(schema.characters.id, 'CHARLOCALZZZZZZZZZZZZZZZZZ'),
    });

  it('merges silently and rebases the pending operation when the server changed a different field', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedLocalCharacter();
    const operation = await seedPendingOperation({
      operationType: 'update',
      payload: JSON.stringify({
        id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
        motivation: 'Nova Motivação',
        version: 1,
      }),
    });
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 5,
      applied: [],
      conflicts: [
        {
          entity: 'Character',
          entityId: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
          type: 'update',
          reason: 'version_conflict',
          message: 'stale',
          clientVersion: 1,
          serverVersion: 2,
          serverEntity: {
            id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
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
    // The row carries the merge of both sides (the server's title, the local motivation), at the
    // version the server will hold once the rebased operation pushes - not the server's current
    // one, which would base the next edit stale.
    expect(await readCharacter()).toMatchObject({
      title: 'Título Novo do Servidor',
      motivation: 'Nova Motivação',
      version: 3,
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
      payload: JSON.stringify({
        id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
        title: 'Título Novo do Servidor',
        version: 1,
      }),
    });
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 5,
      applied: [],
      conflicts: [
        {
          entity: 'Character',
          entityId: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
          type: 'update',
          reason: 'version_conflict',
          message: 'stale',
          clientVersion: 1,
          serverVersion: 2,
          serverEntity: {
            id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
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
    // At the version the server will hold once the rebased operation pushes, not its current one.
    expect(await readCharacter()).toMatchObject({ title: 'Título Novo do Servidor', version: 3 });

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
      payload: JSON.stringify({
        id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
        motivation: 'Minha Motivação',
        version: 1,
      }),
    });
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 5,
      applied: [],
      conflicts: [
        {
          entity: 'Character',
          entityId: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
          type: 'update',
          reason: 'version_conflict',
          message: 'stale',
          clientVersion: 1,
          serverVersion: 2,
          serverEntity: {
            id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
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
      payload: JSON.stringify({
        id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
        motivation: 'Nova Motivação',
        version: 1,
      }),
    });
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 5,
      applied: [],
      conflicts: [
        {
          entity: 'Character',
          entityId: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
          type: 'update',
          reason: 'version_conflict',
          message: 'stale',
          clientVersion: 1,
          serverVersion: 2,
          serverEntity: {
            id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
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
      payload: JSON.stringify({
        id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
        title: 'Título Novo',
        version: 1,
      }),
    });
    pushResponse = {
      message: 'ok',
      processedUpdates: 1,
      serverMaxOperationVersion: 5,
      applied: [],
      conflicts: [
        {
          entity: 'Character',
          entityId: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
          type: 'update',
          reason: 'deleted_on_server',
          message: 'deleted',
          clientVersion: 1,
          serverVersion: 2,
          serverEntity: {
            id: 'CHARLOCALZZZZZZZZZZZZZZZZZ',
            storyId: STORY_ID,
            isDeleted: true,
            version: 2,
          },
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

  it('reports a reachable-server pull failure instead of treating it as offline', async () => {
    await seedStory();
    serverFailureOn = 'pull';

    await expect(runOneCycle()).resolves.toBe('failed');

    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('tells the user to update the app when the server refuses the sync protocol', async () => {
    await seedStory();
    protocolMismatchOn = 'pull';

    await expect(runOneCycle()).resolves.toBe('failed');

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('newer version'),
      'error',
    );
  });

  it('deactivates the story instead of retrying a pull for a story the server deleted', async () => {
    await seedStory();
    storyGoneOn = 'pull';

    await expect(runOneCycle()).resolves.toBe('failed');

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('no longer exists'),
      'error',
    );
    expect((engine as any).storyId).toBeNull();
  });

  it('keeps the pull progress when the story is deleted between the pull and the push', async () => {
    await seedStory();
    await seedPendingOperation();
    pullResponse = {
      updates: [remoteCreate('char-remote', 'Remote', 1)],
      publicFavorites: [],
      serverMaxOperationVersion: 1,
      role: 'owner',
    };
    storyGoneOn = 'push';

    await expect(runOneCycle()).resolves.toBe('failed');

    expect((await readStory())!.lastServerSyncedLog).toBe(1);
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('no longer exists'),
      'error',
    );
    expect((engine as any).storyId).toBeNull();
  });

  it('treats an entity it cannot store as a protocol mismatch, still blocking the pull', async () => {
    await seedStory();
    pullResponse = {
      updates: [
        {
          type: 'update',
          entity: 'SomethingFromTheFuture',
          id: 'FUTURE1ZZZZZZZZZZZZZZZZZZZ',
          operationVersion: 1,
          operationId: 'srv-1',
          changes: { name: 'A newer server knows this' },
        },
        remoteCreate('char-after', 'Depois', 2),
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 2,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('failed');

    // Loud, not silent: the user learns the app is behind. The cursor still does not advance
    // past the unknown operation - skipping it would lose it below the cursor, even after an
    // upgrade - so the story behind it waits too.
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('newer version'),
      'error',
    );
    expect((await readStory())!.lastServerSyncedLog).toBe(0);
    expect(
      await database.db.query.characters.findFirst({
        where: eq(schema.characters.id, 'char-after'),
      }),
    ).toBeUndefined();
  });

  it('keeps the pull result but reports a rejected push without claiming the operation was sent', async () => {
    await seedStory({ lastOperationLog: 1 });
    const operation = await seedPendingOperation();
    serverFailureOn = 'push';

    await expect(runOneCycle()).resolves.toBe('failed');

    expect(
      (
        await database.db.query.operationLogs.findFirst({
          where: eq(schema.operationLogs.id, operation.id),
        })
      )?.isSynced,
    ).toBe(false);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});

describe('guards before a cycle runs', () => {
  it('does nothing without a story', async () => {
    await engine.deactivateStory();

    await expect(runOneCycle()).resolves.toBe('ok');
    expect(seen).toEqual([]);
  });

  it('does nothing when the story is not in the local database', async () => {
    await expect(runOneCycle()).resolves.toBe('ok');
    expect(seen.filter((request) => request.method === 'POST')).toEqual([]);
  });

  it('stops before reaching the network when a story is configured without a server URL', async () => {
    (engine as any).storyId = STORY_ID;
    (engine as any).client.defaults.baseURL = undefined;

    await expect(runOneCycle()).resolves.toBe('ok');
    expect((engine as any).storyId).toBeNull();
    expect(seen).toEqual([]);
  });

  it('stops before reaching the network when its local database was cleared', async () => {
    (engine as any)._db = null;

    await expect(runOneCycle()).resolves.toBe('ok');
    expect((engine as any).storyId).toBeNull();
    expect(seen).toEqual([]);
  });
});

describe('engine control surface', () => {
  it('exposes explicit context lifecycle transitions', async () => {
    expect(engine.lifecycle).toBe('active');

    engine.stopSync();
    expect(engine.lifecycle).toBe('active');

    await engine.deactivateStory();
    expect(engine.lifecycle).toBe('idle');
  });

  it('forwards an explicit sync request to the scheduler', () => {
    const request = jest.spyOn((engine as any).scheduler, 'request');

    engine.requestSync('local-change');

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps the active context stable until an in-flight cycle finishes', async () => {
    let finishCycle!: () => void;
    const contextsSeen: string[] = [];
    jest.spyOn(engine as any, 'performSync').mockImplementation(async () => {
      contextsSeen.push((engine as any).storyId);
      await new Promise<void>((resolve) => {
        finishCycle = resolve;
      });
      contextsSeen.push((engine as any).storyId);
      return false;
    });

    engine.startSync();
    for (let index = 0; index < 8; index += 1) await Promise.resolve();

    let transitionFinished = false;
    const transition = engine
      .activateStory('story-2', {
        ...SERVER,
        id: 'server-2',
        idUser: 'server-user',
        url: 'http://servidor-2',
      } as never)
      .then(() => {
        transitionFinished = true;
      });
    for (let index = 0; index < 8; index += 1) await Promise.resolve();

    expect(transitionFinished).toBe(false);
    expect((engine as any).storyId).toBe(STORY_ID);

    finishCycle();
    await transition;

    expect(contextsSeen).toEqual([STORY_ID, STORY_ID]);
    expect((engine as any).storyId).toBe('story-2');
    expect((engine as any).client.defaults.baseURL).toBe('http://servidor-2/api');
  });

  it('rejects a context transition when stopAndWait times out and keeps the live story', async () => {
    const stopAndWait = jest
      .spyOn((engine as any).scheduler, 'stopAndWait')
      .mockResolvedValue('timed_out');
    const resume = jest.spyOn((engine as any).scheduler, 'resume');
    const previousBaseUrl = (engine as any).client.defaults.baseURL;

    const outcome = await engine.deactivateStory().then(
      () => 'applied',
      (error: Error) => error.message,
    );

    expect(outcome).toMatch(/context transition timed out/);
    expect((engine as any).storyId).toBe(STORY_ID);
    expect((engine as any).client.defaults.baseURL).toBe(previousBaseUrl);
    expect(resume).toHaveBeenCalled();

    // Restore before afterEach's deactivateStory(), which needs a normal idle stop.
    stopAndWait.mockResolvedValue('idle');
  });

  it('does not let an abandoned cycle deactivate a different active story', () => {
    (engine as any).storyId = 'story-2';
    (engine as any).activeServer = {
      ...SERVER,
      id: 'server-2',
      url: 'http://servidor-2',
    };
    (engine as any).client.defaults.baseURL = 'http://servidor-2/api';

    (engine as any).deactivateStoryFromActiveCycle(STORY_ID);

    expect((engine as any).storyId).toBe('story-2');
    expect((engine as any).client.defaults.baseURL).toBe('http://servidor-2/api');
  });

  it('reset clears every connection-bound dependency so a later story cannot inherit it', async () => {
    const stopScheduler = jest
      .spyOn((engine as any).scheduler, 'stopAndWait')
      .mockResolvedValue('idle');
    const resetMedia = jest.spyOn((engine as any).media, 'reset');

    await engine.reset();

    expect(stopScheduler).toHaveBeenCalledTimes(1);
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
    performSyncSpy = jest.spyOn(engine as any, 'performSync').mockResolvedValue('ok');
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
    performSyncSpy.mockResolvedValue('offline'); // 'offline' = server was unreachable this cycle
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

  it('relaxes the cadence while the active server socket is alive, and pulls it back when that one is lost', async () => {
    (engine as any).activeServer = { id: 'srv-1' };
    let live = true;
    engine.setRealtimeProbe((serverId) => serverId === 'srv-1' && live);
    engine.startSync();
    await flush();
    performSyncSpy.mockClear();

    jest.advanceTimersByTime(SYNC_INTERVAL_MS * 2);
    await flush();
    expect(performSyncSpy).not.toHaveBeenCalled();

    live = false;
    engine.realtimeLinkChanged('other-server'); // not the active server: nothing moves
    jest.advanceTimersByTime(SYNC_INTERVAL_MS);
    await flush();
    expect(performSyncSpy).not.toHaveBeenCalled();

    engine.realtimeLinkChanged('srv-1');
    jest.advanceTimersByTime(SYNC_INTERVAL_MS);
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

    await expect(runOneCycle()).resolves.toBe('ok');
  });
});

describe('remote-operation safety boundaries', () => {
  it('does not create a different story while synchronizing the configured story', async () => {
    await seedStory();
    pullResponse = {
      updates: [remoteCreate('foreign-story', 'Não deve entrar', 1)],
      publicFavorites: [],
      serverMaxOperationVersion: 1,
      role: 'owner',
    };
    pullResponse.updates[0] = {
      ...pullResponse.updates[0],
      entity: 'Story',
      id: 'STORYOUTRAZZZZZZZZZZZZZZZZ',
      data: {
        ...pullResponse.updates[0].data,
        id: 'STORYOUTRAZZZZZZZZZZZZZZZZ',
        title: 'Outra história',
      },
    };

    await runOneCycle();

    expect(
      await database.db.query.stories.findFirst({
        where: eq(schema.stories.id, 'STORYOUTRAZZZZZZZZZZZZZZZZ'),
      }),
    ).toBeUndefined();
    const log = await database.db.query.operationLogs.findFirst({
      where: eq(schema.operationLogs.serverOperationVersion, 1),
    });
    expect(log).toBeDefined();
  });

  it('refuses conflict handling before a database is bound', () => {
    const unconfigured = createAppSyncEngine();
    expect(() => (unconfigured as any).conflictService).toThrow(/before bindDatabase/i);
  });

  it('keeps the pull cursor behind a handler failure and reports one actionable error', async () => {
    await seedStory();
    pullResponse = {
      updates: [remoteCreate('char-broken', 'Não aplicar', 4)],
      publicFavorites: [],
      serverMaxOperationVersion: 4,
      role: 'owner',
    };
    (engine as any).entityHandlers.set('Character', {
      setDb: jest.fn(),
      applyCreate: jest.fn().mockRejectedValue(new Error('disco indisponível')),
    });

    await expect(runOneCycle()).resolves.toBe('failed');

    expect((await readStory())?.lastServerSyncedLog).toBe(0);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});

describe('lifecycle and activation guards', () => {
  it('reports unbound before a database is attached', () => {
    expect(createAppSyncEngine().lifecycle).toBe('unbound');
  });

  it('reports running while the scheduler chain is active', async () => {
    jest.useFakeTimers();
    try {
      jest.spyOn(engine as any, 'performSync').mockResolvedValue('ok');
      engine.startSync();
      expect(engine.lifecycle).toBe('running');
    } finally {
      engine.stopSync();
      jest.useRealTimers();
    }
  });

  it('binding the same database twice resolves without redoing the transition', async () => {
    await expect(engine.bindDatabase(database.db)).resolves.toBeUndefined();
    expect(engine.lifecycle).toBe('active');
  });

  it('refuses activation without a story', () => {
    expect(() => engine.activateStory('', { ...SERVER, idUser: 'server-user' } as never)).toThrow(
      'a story is required for activation',
    );
  });

  it('refuses activation without a server URL', () => {
    expect(() =>
      engine.activateStory('story-x', { ...SERVER, idUser: 'server-user', url: '' } as never),
    ).toThrow('a server URL is required for activation');
  });

  it('refuses activation before a database is bound', async () => {
    const fresh = createAppSyncEngine();
    await expect(
      fresh.activateStory(STORY_ID, { ...SERVER, idUser: 'server-user' } as never),
    ).rejects.toThrow('bind the database before activating a story');
  });

  it('forwards a bare sync request to the scheduler', () => {
    const request = jest.spyOn((engine as any).scheduler, 'request');
    engine.requestSync();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('delegates server story previews to the transfer module', async () => {
    const previews = [{ id: 'STORYREMOTEZZZZZZZZZZZZZZZ', title: 'Remota' }];
    (pullResponse as any).storyPreviews = previews;
    await expect(
      engine.fetchServerStoryPreviews({ ...SERVER, idUser: 'server-user' } as never),
    ).resolves.toEqual(previews);
  });

  it('runs media reconciliation against the live context outside a cycle', async () => {
    await expect((engine as any).media.sync()).resolves.toBe(false);
    expect(mockSyncStoryMedia).toHaveBeenCalled();
  });

  it('resolves the cycle database, story and client outside a cycle', () => {
    expect((engine as any).resolveCycleDb()).toBe(database.db);
    expect((engine as any).resolveCycleStoryId()).toBe(STORY_ID);
    expect((engine as any).resolveCycleClient()).toBe((engine as any).client);
  });

  it('refuses to resolve sync dependencies before configuration', () => {
    const fresh = createAppSyncEngine();
    expect(() => (fresh as any).resolveCycleDb()).toThrow('Sync database is not configured.');
    expect(() => (fresh as any).resolveCycleStoryId()).toThrow('Sync story is not configured.');
  });

  it('refuses the abort signal outside an active cycle', () => {
    expect(() => (engine as any).push.context.abortSignal()).toThrow(
      'Sync abort signal is not available outside an active cycle.',
    );
  });
});

describe('pull response fallbacks', () => {
  it('treats a story that never synced as reader until the pull reports a role', async () => {
    await seedStory({ myRole: null });
    delete (pullResponse as any).role;

    await runOneCycle();

    expect((await readStory())?.myRole).toBe('reader');
  });

  it('tolerates a pull page with no updates list', async () => {
    await seedStory();
    delete (pullResponse as any).updates;

    await expect(runOneCycle()).resolves.toBe('ok');
    expect((await readStory())?.lastServerSyncedLog).toBe(0);
  });

  it('treats a remote operation without a version as version zero', async () => {
    await seedStory();
    const update = { ...remoteCreate('char-noversion', 'Sem versão', 0) };
    delete (update as any).operationVersion;
    pullResponse = {
      updates: [update],
      publicFavorites: [],
      serverMaxOperationVersion: 0,
      role: 'owner',
    };

    await runOneCycle();

    const row = await database.db.query.characters.findFirst({
      where: eq(schema.characters.id, 'char-noversion'),
    });
    expect(row?.name).toBe('Sem versão');
    expect((await readStory())?.lastServerSyncedLog).toBe(0);
  });
});

describe('direct apply paths', () => {
  it('applies a remote update directly when nothing local is pending', async () => {
    await seedStory();
    await database.db.insert(schema.characters).values({
      id: 'CHARDIRECTZZZZZZZZZZZZZZZZ',
      storyId: STORY_ID,
      name: 'Antes',
      ...base,
    });
    pullResponse = {
      updates: [
        {
          type: 'update',
          entity: 'Character',
          id: 'CHARDIRECTZZZZZZZZZZZZZZZZ',
          operationVersion: 2,
          operationId: 'srv-2',
          version: 2,
          changes: { name: 'Depois', version: 2 },
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 2,
      role: 'owner',
    };

    await runOneCycle();

    const row = await database.db.query.characters.findFirst({
      where: eq(schema.characters.id, 'CHARDIRECTZZZZZZZZZZZZZZZZ'),
    });
    expect(row?.name).toBe('Depois');
    expect((await readStory())?.lastServerSyncedLog).toBe(2);
  });

  it('applies a remote delete directly when nothing local is pending', async () => {
    await seedStory();
    await database.db.insert(schema.characters).values({
      id: 'CHARGONEZZZZZZZZZZZZZZZZZZ',
      storyId: STORY_ID,
      name: 'Finado',
      ...base,
    });
    pullResponse = {
      updates: [
        {
          type: 'delete',
          entity: 'Character',
          id: 'CHARGONEZZZZZZZZZZZZZZZZZZ',
          operationVersion: 3,
          operationId: 'srv-3',
          version: 2,
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 3,
      role: 'owner',
    };

    await runOneCycle();

    const row = await database.db.query.characters.findFirst({
      where: eq(schema.characters.id, 'CHARGONEZZZZZZZZZZZZZZZZZZ'),
    });
    expect(row?.isDeleted).toBe(true);
    expect((await readStory())?.lastServerSyncedLog).toBe(3);
  });

  it('blocks the pull loudly on an update type it does not know', async () => {
    await seedStory();
    pullResponse = {
      updates: [
        {
          type: 'rename',
          entity: 'Character',
          id: 'CHARXZZZZZZZZZZZZZZZZZZZZZ',
          operationVersion: 1,
          operationId: 'srv-1',
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 1,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('failed');

    // Fail-closed like an unknown entity: skipping would lose the operation below the cursor,
    // even after an upgrade.
    expect(
      await database.db.query.characters.findFirst({
        where: eq(schema.characters.id, 'CHARXZZZZZZZZZZZZZZZZZZZZZ'),
      }),
    ).toBeUndefined();
    const logged = await database.db.query.operationLogs.findMany({
      where: eq(schema.operationLogs.entityId, 'CHARXZZZZZZZZZZZZZZZZZZZZZ'),
    });
    expect(logged).toHaveLength(0);
    expect((await readStory())?.lastServerSyncedLog).toBe(0);
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('newer version'),
      'error',
    );
  });
});

describe('echoes and malformed updates', () => {
  it('skips re-applying its own echoed operation', async () => {
    await seedStory();
    await seedPendingOperation({
      entityType: 'Character',
      entityId: 'CHARECHOZZZZZZZZZZZZZZZZZZ',
      operationType: 'update',
      payload: JSON.stringify({
        id: 'CHARECHOZZZZZZZZZZZZZZZZZZ',
        storyId: STORY_ID,
        name: 'Eco',
        version: 2,
      }),
      isSynced: true,
      serverOperationVersion: 5,
    });
    pullResponse = {
      updates: [
        {
          type: 'update',
          entity: 'Character',
          id: 'CHARECHOZZZZZZZZZZZZZZZZZZ',
          operationVersion: 5,
          operationId: 'srv-5',
          version: 2,
          changes: { name: 'Eco', version: 2 },
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 5,
      role: 'owner',
    };

    await runOneCycle();

    const logged = await database.db.query.operationLogs.findMany({
      where: eq(schema.operationLogs.serverOperationVersion, 5),
    });
    expect(logged).toHaveLength(1);
    expect(
      await database.db.query.characters.findFirst({
        where: eq(schema.characters.id, 'CHARECHOZZZZZZZZZZZZZZZZZZ'),
      }),
    ).toBeUndefined();
    expect((await readStory())?.lastServerSyncedLog).toBe(5);
  });

  it('contains a remote update that arrives without an id', async () => {
    await seedStory();
    pullResponse = {
      updates: [
        {
          type: 'update',
          entity: 'Character',
          operationVersion: 1,
          operationId: 'srv-1',
          version: 2,
          changes: { name: 'Sem dono', version: 2 },
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 1,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('failed');
    expect((await readStory())?.lastServerSyncedLog).toBe(0);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});

describe('pull failure containment', () => {
  it('stops the batch at the first failure instead of skipping it', async () => {
    await seedStory();
    pullResponse = {
      updates: [
        remoteCreate('char-broken', 'Quebrado', 1),
        remoteCreate('char-skipped', 'Pulado', 2),
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 2,
      role: 'owner',
    };
    (engine as any).entityHandlers.set('Character', {
      setDb: jest.fn(),
      getById: jest.fn().mockResolvedValue(undefined),
      applyCreate: jest.fn().mockRejectedValue(new Error('disco indisponível')),
    });

    await expect(runOneCycle()).resolves.toBe('failed');

    expect(
      await database.db.query.characters.findFirst({
        where: eq(schema.characters.id, 'char-skipped'),
      }),
    ).toBeUndefined();
    expect((await readStory())?.lastServerSyncedLog).toBe(0);
  });

  it('reports each failing entity only once per cycle', async () => {
    await seedStory();
    pullResponse = {
      updates: [
        remoteCreate('char-broken', 'Quebrado', 1),
        {
          type: 'create',
          entity: 'CustomWidget',
          id: 'WIDGETBROKENZZZZZZZZZZZZZZ',
          operationVersion: 2,
          operationId: 'srv-2',
          data: { id: 'WIDGETBROKENZZZZZZZZZZZZZZ' },
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 2,
      role: 'owner',
    };
    const failingHandler = () => ({
      setDb: jest.fn(),
      getById: jest.fn().mockResolvedValue(undefined),
      applyCreate: jest.fn().mockRejectedValue(new Error('disco indisponível')),
    });
    (engine as any).entityHandlers.set('Character', failingHandler());
    (engine as any).entityHandlers.set('CustomWidget', failingHandler());

    // The batch stops at the first failure, so a single failing op cannot tell per-item from
    // consolidated reporting. Two cycles burn the Character's retries; on the third it is
    // retired and the batch reaches the widget, failing two entities in one cycle.
    await expect(runOneCycle()).resolves.toBe('failed');
    await expect(runOneCycle()).resolves.toBe('failed');
    mockShowNotification.mockClear();

    await expect(runOneCycle()).resolves.toBe('failed');

    expect(mockShowNotification).toHaveBeenCalledTimes(1);
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('Character'),
      'error',
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('CustomWidget'),
      'error',
    );
  });

  it('keeps applying entities it has no refresh event for', async () => {
    await seedStory();
    const applyCreate = jest.fn().mockResolvedValue(undefined);
    (engine as any).entityHandlers.set('CustomWidget', {
      setDb: jest.fn(),
      getById: jest.fn().mockResolvedValue(undefined),
      applyCreate,
    });
    pullResponse = {
      updates: [
        {
          type: 'create',
          entity: 'CustomWidget',
          id: 'WIDGET1ZZZZZZZZZZZZZZZZZZZ',
          operationVersion: 1,
          operationId: 'srv-1',
          data: { id: 'WIDGET1ZZZZZZZZZZZZZZZZZZZ' },
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 1,
      role: 'owner',
    };

    await runOneCycle();

    expect(applyCreate).toHaveBeenCalledWith(
      STORY_ID,
      expect.objectContaining({ id: 'WIDGET1ZZZZZZZZZZZZZZZZZZZ' }),
    );
    expect((await readStory())?.lastServerSyncedLog).toBe(1);
  });

  it('fails the cycle loudly when the pull itself throws a non-Error', async () => {
    await seedStory();
    throwStringOn = 'pull';

    await expect(runOneCycle()).resolves.toBe('failed');
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});

describe('favorites over the updates channel', () => {
  const favoriteData = {
    id: 'FAV1ZZZZZZZZZZZZZZZZZZZZZZ',
    storyId: STORY_ID,
    entityId: 'CHAR1ZZZZZZZZZZZZZZZZZZZZZ',
    entityType: 'Character',
    userId: 'other-user',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    version: 1,
    isDeleted: false,
    deletedAt: null,
  };
  const favoriteCreate = (overrides: Record<string, any> = {}) => ({
    type: 'create',
    entity: 'Favorite',
    id: 'FAV1ZZZZZZZZZZZZZZZZZZZZZZ',
    operationVersion: 3,
    operationId: 'srv-3',
    data: { ...favoriteData, ...overrides },
  });

  it('advances the public-favorite cursor and announces the favorite to its target', async () => {
    await seedStory();
    const emit = jest.spyOn(entityEventEmitter, 'emit');
    pullResponse = {
      updates: [favoriteCreate()],
      publicFavorites: [],
      serverMaxOperationVersion: 3,
      role: 'owner',
    };

    await runOneCycle();

    expect(
      await database.db.query.favorites.findFirst({
        where: eq(schema.favorites.id, 'FAV1ZZZZZZZZZZZZZZZZZZZZZZ'),
      }),
    ).toBeDefined();
    expect((await readStory())?.lastPublicFavoriteLog).toBe(3);
    expect(emit).toHaveBeenCalledWith(
      'favorite_changed',
      STORY_ID,
      'Character',
      'CHAR1ZZZZZZZZZZZZZZZZZZZZZ',
      'other-user',
    );
    expect(emit).toHaveBeenCalledWith('character_changed', STORY_ID, 'CHAR1ZZZZZZZZZZZZZZZZZZZZZ');
  });

  it('emits no target event for a favorite whose type has none', async () => {
    await seedStory();
    const emit = jest.spyOn(entityEventEmitter, 'emit');
    pullResponse = {
      updates: [favoriteCreate({ entityType: 'Choice', entityId: 'CHOICE1ZZZZZZZZZZZZZZZZZZZ' })],
      publicFavorites: [],
      serverMaxOperationVersion: 3,
      role: 'owner',
    };

    await runOneCycle();

    expect(emit).toHaveBeenCalledWith(
      'favorite_changed',
      STORY_ID,
      'Choice',
      'CHOICE1ZZZZZZZZZZZZZZZZZZZ',
      'other-user',
    );
    expect(emit).not.toHaveBeenCalledWith('choice_changed', STORY_ID, 'CHOICE1ZZZZZZZZZZZZZZZZZZZ');
  });

  it('closes a favorite delete without re-reading the removed row', async () => {
    await seedStory();
    const emit = jest.spyOn(entityEventEmitter, 'emit');
    pullResponse = {
      updates: [
        {
          type: 'delete',
          entity: 'Favorite',
          id: 'FAVGHOSTZZZZZZZZZZZZZZZZZZ',
          operationVersion: 2,
          operationId: 'srv-2',
          version: 1,
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 2,
      role: 'owner',
    };

    await runOneCycle();

    expect(emit).not.toHaveBeenCalledWith(
      'favorite_changed',
      STORY_ID,
      expect.anything(),
      'FAVGHOSTZZZZZZZZZZZZZZZZZZ',
      expect.anything(),
    );
    expect((await readStory())?.lastServerSyncedLog).toBe(2);
  });

  it('holds the public-favorite cursor when a favorite fails to apply', async () => {
    await seedStory();
    pullResponse = {
      updates: [favoriteCreate()],
      publicFavorites: [],
      serverMaxOperationVersion: 3,
      role: 'owner',
    };
    (engine as any).entityHandlers.set('Favorite', {
      setDb: jest.fn(),
      getById: jest.fn().mockResolvedValue(undefined),
      applyCreate: jest.fn().mockRejectedValue(new Error('disco indisponível')),
    });

    await expect(runOneCycle()).resolves.toBe('failed');

    expect((await readStory())?.lastPublicFavoriteLog).toBe(0);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('keeps the existing cursor when an old favorite operation fails', async () => {
    await seedStory({ lastPublicFavoriteLog: 5 });
    const update = favoriteCreate();
    delete (update as any).operationVersion;
    pullResponse = {
      updates: [update],
      publicFavorites: [],
      serverMaxOperationVersion: 5,
      role: 'owner',
    };
    (engine as any).entityHandlers.set('Favorite', {
      setDb: jest.fn(),
      getById: jest.fn().mockResolvedValue(undefined),
      applyCreate: jest.fn().mockRejectedValue(new Error('disco indisponível')),
    });

    await expect(runOneCycle()).resolves.toBe('failed');

    expect((await readStory())?.lastPublicFavoriteLog).toBe(5);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('throws a clear error when public favorites arrive with no Favorite handler', async () => {
    await seedStory();
    (engine as any).entityHandlers.delete('Favorite');
    pullResponse = {
      updates: [],
      publicFavorites: [{ ...favoriteData }],
      serverMaxOperationVersion: 0,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('failed');
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('imports a public favorite whose target type has no event', async () => {
    await seedStory();
    const emit = jest.spyOn(entityEventEmitter, 'emit');
    pullResponse = {
      updates: [],
      publicFavorites: [
        { ...favoriteData, entityType: 'Choice', entityId: 'CHOICE1ZZZZZZZZZZZZZZZZZZZ' },
      ],
      serverMaxOperationVersion: 0,
      role: 'owner',
    };

    await runOneCycle();

    expect(emit).toHaveBeenCalledWith(
      'favorite_changed',
      STORY_ID,
      'Choice',
      'CHOICE1ZZZZZZZZZZZZZZZZZZZ',
      'other-user',
    );
    expect(emit).not.toHaveBeenCalledWith('choice_changed', STORY_ID, 'CHOICE1ZZZZZZZZZZZZZZZZZZZ');
  });
});

describe('push outcomes', () => {
  it('stops immediately when the cycle signal is already aborted', async () => {
    await seedStory();
    const controller = new AbortController();
    controller.abort();

    await expect((engine as any).performSync(controller.signal)).resolves.toBe('ok');
    expect(seen).toHaveLength(0);
  });

  it('aborts the cycle when the push is cancelled', async () => {
    await seedStory();
    await seedPendingOperation();
    abortPush = true;

    await expect(runOneCycle()).resolves.toBe('ok');
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('names an unparsable push failure instead of crashing on its message', async () => {
    await seedStory();
    await seedPendingOperation();
    throwStringOn = 'push';

    await expect(runOneCycle()).resolves.toBe('failed');
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});

describe('cycle binding', () => {
  it('leaves a newer binding alone when an abandoned cycle finishes', async () => {
    await seedStory();
    pullGate = { opened: false, waiters: [] };
    const cycle = runOneCycle();
    while (!seen.some((request) => request.url.includes('/pull'))) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const usurper = { tampered: true };
    (engine as any).cycleBinding = usurper as never;
    pullGate.opened = true;
    pullGate.waiters.splice(0).forEach((release) => release());

    await expect(cycle).resolves.toBe('ok');
    expect((engine as any).cycleBinding).toBe(usurper);
  });

  it('skips the server timestamp when no server record is bound', async () => {
    await seedStory();
    (engine as any).activeServer = null;

    await expect(runOneCycle()).resolves.toBe('ok');
    const server = await database.db.query.servers.findFirst({
      where: eq(schema.servers.id, SERVER.id),
    });
    expect(server?.lastSyncDate).toBeNull();
  });
});

describe('pull-side auto-merge', () => {
  it('rebases a pending edit silently when the server touched a different field', async () => {
    await seedStory();
    await database.db.insert(schema.characters).values({
      id: 'CHARMERGEZZZZZZZZZZZZZZZZZ',
      storyId: STORY_ID,
      name: 'Local',
      ...base,
    });
    await seedPendingOperation({
      entityType: 'Character',
      entityId: 'CHARMERGEZZZZZZZZZZZZZZZZZ',
      operationType: 'update',
      payload: JSON.stringify({
        id: 'CHARMERGEZZZZZZZZZZZZZZZZZ',
        storyId: STORY_ID,
        name: 'Local',
        version: 2,
      }),
    });
    pullResponse = {
      updates: [
        {
          type: 'update',
          entity: 'Character',
          id: 'CHARMERGEZZZZZZZZZZZZZZZZZ',
          operationVersion: 1,
          operationId: 'srv-1',
          version: 2,
          changes: { description: 'Remota', version: 2 },
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 1,
      role: 'owner',
    };

    await runOneCycle();

    expect(await database.db.query.syncConflicts.findMany()).toHaveLength(0);
    const row = await database.db.query.characters.findFirst({
      where: eq(schema.characters.id, 'CHARMERGEZZZZZZZZZZZZZZZZZ'),
    });
    expect(row?.description).toBe('Remota');
    const stillPending = await database.db.query.operationLogs.findMany({
      where: eq(schema.operationLogs.isSynced, false),
    });
    expect(stillPending.length).toBeGreaterThan(0);
  });

  it('records one conflict per entity and keeps the rest of the story moving', async () => {
    await seedStory();
    let seedVersion = 0;
    for (const id of ['char-a', 'char-b']) {
      await database.db.insert(schema.characters).values({
        id,
        storyId: STORY_ID,
        name: 'Local',
        ...base,
      });
      seedVersion += 1;
      await seedPendingOperation({
        entityType: 'Character',
        entityId: id,
        operationType: 'update',
        operationVersion: seedVersion,
        payload: JSON.stringify({ id, storyId: STORY_ID, name: 'Local', version: 2 }),
      });
    }
    pullResponse = {
      updates: ['char-a', 'char-b'].map((id, index) => ({
        type: 'update',
        entity: 'Character',
        id,
        operationVersion: index + 1,
        operationId: `srv-${index + 1}`,
        version: 2,
        changes: { name: `Remote${index}`, version: 2 },
      })),
      publicFavorites: [],
      serverMaxOperationVersion: 2,
      role: 'owner',
    };

    // Conflicts are decisions for the user, not a blocked batch: the cycle still reports ok.
    await expect(runOneCycle()).resolves.toBe('ok');

    const conflicts = await database.db.query.syncConflicts.findMany();
    expect(conflicts).toHaveLength(2);
    expect((await readStory())?.lastServerSyncedLog).toBe(2);
  });
});
