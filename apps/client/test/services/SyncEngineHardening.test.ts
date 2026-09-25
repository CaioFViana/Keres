/**
 * @jest-environment node
 */
const mockShowNotification = jest.fn();
jest.mock('../../src/state/notificationStore', () => ({
  useNotificationStore: { getState: () => ({ showNotification: mockShowNotification }) },
}));

// Media reconciliation runs at the end of every cycle; here it must not interfere.
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
import type { SyncEngineService } from '../../src/services/SyncEngineService';
import { createAppSyncEngine } from '../../src/services/sync/appSyncEngine';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

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

/** What the server "has" for the pull; each test adjusts it. */
let pullResponse: {
  updates: any[];
  publicFavorites?: any[];
  serverMaxOperationVersion: number;
  role: string;
};
let pushResponse: any;
/** A reachable server can still reject a request; that is not an offline retry. */
let serverFailureOn: 'pull' | 'push' | null;
/** When true, the pull fails as if the request had been cancelled mid-flight. */
let abortPull: boolean;
/** When true, the push POST is refused with HTTP 426. */
let protocolMismatchPush: boolean;
/** When true, the push POST fails as if the network dropped after the pull. */
let offlinePush: boolean;

function installAdapter() {
  seen = [];
  (axios.defaults as any).adapter = async (config: any) => {
    const url = `${config.url}`;
    const method = (config.method || 'get').toUpperCase();
    const body = config.data ? JSON.parse(config.data) : undefined;
    seen.push({ method, url, body });

    const isPull = url.includes('/pull');
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

    if (isPull && abortPull) {
      const error: any = new Error('canceled');
      error.name = 'AbortError';
      error.code = 'ERR_CANCELED';
      error.config = config;
      throw error;
    }
    if (!isPull && method === 'POST' && protocolMismatchPush) {
      const error: any = new Error('Request failed with status code 426');
      error.config = config;
      error.request = {};
      error.response = { status: 426, data: { message: 'update the app' }, config, headers: {} };
      throw error;
    }
    if (!isPull && method === 'POST' && offlinePush) {
      const error: any = new Error('Network Error');
      error.code = 'ERR_NETWORK';
      error.config = config;
      error.request = {};
      throw error;
    }

    const data = isPull ? pullResponse : method === 'POST' ? pushResponse : {};
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

/** A single synchronization cycle, without timers. */
async function runOneCycle(): Promise<'ok' | 'offline' | 'failed'> {
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
  serverFailureOn = null;
  abortPull = false;
  protocolMismatchPush = false;
  offlinePush = false;
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

describe('skip after repeated failures', () => {
  it('retries a failing operation, then skips past it on the third failure and keeps the batch moving', async () => {
    await seedStory();
    pullResponse = {
      updates: [remoteCreate('char-poison', 'Poison', 4), remoteCreate('char-after', 'After', 5)],
      publicFavorites: [],
      serverMaxOperationVersion: 5,
      role: 'owner',
    };
    const realHandler = (engine as any).entityHandlers.get('Character');
    (engine as any).entityHandlers.set('Character', {
      setDb: (...args: any[]) => realHandler.setDb(...args),
      getById: (...args: any[]) => realHandler.getById(...args),
      applyCreate: jest.fn().mockImplementation(async (storyId: string, update: any) => {
        if (update?.id === 'char-poison') throw new Error('poison');
        return realHandler.applyCreate(storyId, update);
      }),
      applyUpdate: (...args: any[]) => realHandler.applyUpdate(...args),
      applyDelete: (...args: any[]) => realHandler.applyDelete(...args),
    });

    // A batch stopped by a poisoned operation reports failure, not a healthy 'ok'.
    await expect(runOneCycle()).resolves.toBe('failed');
    expect((await readStory())!.lastServerSyncedLog).toBe(0);

    await expect(runOneCycle()).resolves.toBe('failed');
    expect((await readStory())!.lastServerSyncedLog).toBe(0);

    // Third consecutive failure: the poisoned operation is retired (recorded, cursor advanced)
    // and the rest of the batch still applies.
    await expect(runOneCycle()).resolves.toBe('ok');
    expect((await readStory())!.lastServerSyncedLog).toBe(5);
    expect(
      await database.db.query.characters.findFirst({
        where: eq(schema.characters.id, 'char-after'),
      }),
    ).toMatchObject({ name: 'After' });
    expect(
      await database.db.query.characters.findFirst({
        where: eq(schema.characters.id, 'char-poison'),
      }),
    ).toBeUndefined();
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('Character'),
      'error',
    );
  });

  it('recovers when a transient failure stops before the third attempt', async () => {
    await seedStory();
    pullResponse = {
      updates: [remoteCreate('char-flaky', 'Flaky', 4)],
      publicFavorites: [],
      serverMaxOperationVersion: 4,
      role: 'owner',
    };
    const realHandler = (engine as any).entityHandlers.get('Character');
    let attempts = 0;
    (engine as any).entityHandlers.set('Character', {
      setDb: (...args: any[]) => realHandler.setDb(...args),
      getById: (...args: any[]) => realHandler.getById(...args),
      applyCreate: jest.fn().mockImplementation(async (storyId: string, update: any) => {
        attempts += 1;
        if (attempts <= 2) throw new Error('transient');
        return realHandler.applyCreate(storyId, update);
      }),
    });

    await runOneCycle();
    expect((await readStory())!.lastServerSyncedLog).toBe(0);
    await runOneCycle();
    expect((await readStory())!.lastServerSyncedLog).toBe(0);

    await runOneCycle();
    expect((await readStory())!.lastServerSyncedLog).toBe(4);
    expect(
      await database.db.query.characters.findFirst({
        where: eq(schema.characters.id, 'char-flaky'),
      }),
    ).toMatchObject({ name: 'Flaky' });
    // The success cleared the consecutive-failure count for that operation.
    expect((engine as any).pullApply.failureCounts.has(4)).toBe(false);
  });
});

describe('pull failure containment', () => {
  it('still pushes local work when the pull itself fails with a server error', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation();
    serverFailureOn = 'pull';

    await expect(runOneCycle()).resolves.toBe('failed');

    const posts = seen.filter((request) => request.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toHaveLength(1);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
    expect((await readStory())!.lastServerSyncedLog).toBe(0);
  });

  it('persists the pull cursor even when the push is rejected', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation();
    pullResponse = {
      updates: [remoteCreate('char-remoto', 'Keres', 5)],
      publicFavorites: [],
      serverMaxOperationVersion: 5,
      role: 'owner',
    };
    serverFailureOn = 'push';

    await expect(runOneCycle()).resolves.toBe('failed');

    expect((await readStory())!.lastServerSyncedLog).toBe(5);
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });
});

describe('unknown entities stay fail-closed', () => {
  it('keeps blocking past an unknown entity without ever skipping it', async () => {
    await seedStory();
    pullResponse = {
      updates: [
        { ...remoteCreate('future-1', 'From a newer client', 8), entity: 'FutureEntity' },
        remoteCreate('char-after', 'After', 9),
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 9,
      role: 'owner',
    };

    // Still fail-closed (never skipped), but the stuck pull reports failure every cycle.
    await expect(runOneCycle()).resolves.toBe('failed');
    await expect(runOneCycle()).resolves.toBe('failed');
    await expect(runOneCycle()).resolves.toBe('failed');

    expect((await readStory())!.lastServerSyncedLog).toBe(0);
    expect(
      await database.db.query.characters.findFirst({
        where: eq(schema.characters.id, 'char-after'),
      }),
    ).toBeUndefined();
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('newer version'),
      'error',
    );
  });
});

describe('pull batch edge containment', () => {
  it('notifies once when two ops of the same entity fail in one batch', async () => {
    await seedStory();
    pullResponse = {
      updates: [remoteCreate('char-a', 'A', 4), remoteCreate('char-b', 'B', 5)],
      publicFavorites: [],
      serverMaxOperationVersion: 5,
      role: 'owner',
    };
    // The first op already failed twice: this cycle retires it, then the second op of the
    // same entity fails too - one consolidated notification, not one per record.
    (engine as any).pullApply.failureCounts.set(4, 2);
    const realHandler = (engine as any).entityHandlers.get('Character');
    (engine as any).entityHandlers.set('Character', {
      setDb: (...args: any[]) => realHandler.setDb(...args),
      getById: (...args: any[]) => realHandler.getById(...args),
      applyCreate: jest.fn().mockRejectedValue(new Error('poison')),
      applyUpdate: (...args: any[]) => realHandler.applyUpdate(...args),
      applyDelete: (...args: any[]) => realHandler.applyDelete(...args),
    });

    await expect(runOneCycle()).resolves.toBe('failed');

    // Retired past 4, blocked behind 5.
    expect((await readStory())!.lastServerSyncedLog).toBe(4);
    expect(mockShowNotification).toHaveBeenCalledTimes(1);
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('Character'),
      'error',
    );
  });

  it('resolves quietly when the pull itself is aborted', async () => {
    await seedStory();
    abortPull = true;

    await expect(runOneCycle()).resolves.toBe('ok');

    expect(seen.filter((request) => request.method === 'POST')).toEqual([]);
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('reports a push refused on protocol without crashing the cycle', async () => {
    await seedStory({ lastOperationLog: 1 });
    await seedPendingOperation();
    protocolMismatchPush = true;

    await expect(runOneCycle()).resolves.toBe('failed');

    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('newer version'),
      'error',
    );
  });

  it('reports offline when only media reconciliation finds no server', async () => {
    await seedStory();
    mockSyncStoryMedia.mockResolvedValueOnce({
      uploaded: 0,
      downloaded: 0,
      failed: 0,
      offline: true,
    });

    await expect(runOneCycle()).resolves.toBe('offline');
  });

  it('applies an update that arrives without an operation version', async () => {
    await seedStory();
    await database.db.insert(schema.characters).values({
      id: 'char-1',
      storyId: STORY_ID,
      name: 'Local',
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      isDeleted: false,
    });
    pullResponse = {
      updates: [
        {
          type: 'update',
          entity: 'Character',
          id: 'char-1',
          version: 2,
          changes: { name: 'Remote', version: 2 },
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 0,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('ok');

    expect(
      await database.db.query.characters.findFirst({
        where: eq(schema.characters.id, 'char-1'),
      }),
    ).toMatchObject({ name: 'Remote' });
    expect((await readStory())!.lastServerSyncedLog).toBe(0);
  });
});

describe('post-cursor failures', () => {
  async function runCycleWithRoleListener(listener: () => void) {
    entityEventEmitter.on('story_role_changed', listener);
    try {
      return await runOneCycle();
    } finally {
      entityEventEmitter.off('story_role_changed', listener);
    }
  }

  it('fails the cycle loudly when a post-persist step throws', async () => {
    await seedStory({ myRole: 'reader' });

    const outcome = await runCycleWithRoleListener(() => {
      throw new Error('listener boom');
    });

    expect(outcome).toBe('failed');
    expect(mockShowNotification).toHaveBeenCalledWith(expect.any(String), 'error');
  });

  it('reports offline when a post-persist step fails unreachable', async () => {
    await seedStory({ myRole: 'reader' });

    const outcome = await runCycleWithRoleListener(() => {
      const error: any = new Error('Network Error');
      error.code = 'ERR_NETWORK';
      error.request = {};
      throw error;
    });

    expect(outcome).toBe('offline');
    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  it('asks for an app update when a post-persist step hits a protocol refusal', async () => {
    await seedStory({ myRole: 'reader' });

    const outcome = await runCycleWithRoleListener(() => {
      const error: any = new Error('Request failed with status code 426');
      error.response = { status: 426 };
      throw error;
    });

    expect(outcome).toBe('failed');
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('newer version'),
      'error',
    );
  });
});

describe('push goes offline after a successful pull', () => {
  it('keeps the pull progress instead of re-fetching it on the next cycle', async () => {
    await seedStory({ lastOperationLog: 1 });
    const operation = await seedPendingOperation();
    pullResponse = {
      updates: [remoteCreate('char-remote', 'Remote', 4)],
      publicFavorites: [],
      serverMaxOperationVersion: 4,
      role: 'owner',
    };
    offlinePush = true;

    await expect(runOneCycle()).resolves.toBe('offline');

    expect((await readStory())!.lastServerSyncedLog).toBe(4);
    expect(
      await database.db.query.characters.findFirst({
        where: eq(schema.characters.id, 'char-remote'),
      }),
    ).toMatchObject({ name: 'Remote' });
    // The push never went out, so the local operation stays queued for the retry.
    expect(
      await database.db.query.operationLogs.findFirst({
        where: eq(schema.operationLogs.id, operation.id),
      }),
    ).toMatchObject({ isSynced: false });
  });
});

describe('blocked pull reports failure', () => {
  it('fails the cycle when an unknown entity stops the batch', async () => {
    await seedStory();
    pullResponse = {
      updates: [
        {
          type: 'update',
          entity: 'SomethingFromTheFuture',
          id: 'future-1',
          operationVersion: 4,
          operationId: 'srv-4',
          changes: { name: 'A newer server knows this' },
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 4,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('failed');

    expect((await readStory())!.lastServerSyncedLog).toBe(0);
  });
});

describe('story switching drops per-story sync state', () => {
  it('clears failure counts and the backoff streak on activation', async () => {
    (engine as any).pullApply.failureCounts.set(4, 2);
    (engine as any).scheduler.consecutiveFailures = 3;

    await engine.activateStory('other-story', { ...SERVER, idUser: 'server-user' } as never);

    expect((engine as any).pullApply.failureCounts.size).toBe(0);
    expect((engine as any).scheduler.consecutiveFailures).toBe(0);
  });
});

describe('unknown operation types stay fail-closed', () => {
  it('blocks the pull loudly instead of skipping past an uninterpretable operation', async () => {
    await seedStory();
    pullResponse = {
      updates: [
        { ...remoteCreate('char-x', 'X', 4), type: 'teleport' },
        remoteCreate('char-after', 'After', 5),
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 5,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('failed');

    expect((await readStory())!.lastServerSyncedLog).toBe(0);
    expect(
      await database.db.query.characters.findFirst({
        where: eq(schema.characters.id, 'char-after'),
      }),
    ).toBeUndefined();
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining('newer version'),
      'error',
    );
  });

  it('holds the cursor even when local work is pending on the same entity', async () => {
    await seedStory({ lastOperationLog: 1 });
    const operation = await seedPendingOperation({ entityId: 'char-x' });
    pullResponse = {
      updates: [{ ...remoteCreate('char-x', 'X', 4), type: 'teleport' }],
      publicFavorites: [],
      serverMaxOperationVersion: 4,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('failed');

    expect((await readStory())!.lastServerSyncedLog).toBe(0);
    expect(
      await database.db.query.operationLogs.findFirst({
        where: eq(schema.operationLogs.id, operation.id),
      }),
    ).toMatchObject({ isSynced: false });
  });
});

describe('failure counting without operation versions', () => {
  const poisonCreates = () => {
    const realHandler = (engine as any).entityHandlers.get('Character');
    (engine as any).entityHandlers.set('Character', {
      setDb: (...args: any[]) => realHandler.setDb(...args),
      getById: (...args: any[]) => realHandler.getById(...args),
      applyCreate: jest.fn().mockRejectedValue(new Error('poison')),
      applyUpdate: (...args: any[]) => realHandler.applyUpdate(...args),
      applyDelete: (...args: any[]) => realHandler.applyDelete(...args),
    });
  };
  const unversionedCreate = (id: string, name: string, operationId?: string) => ({
    ...remoteCreate(id, name, 0),
    operationVersion: undefined,
    operationId,
  });

  it('counts unversioned operations separately by server id instead of sharing key 0', async () => {
    await seedStory();
    poisonCreates();
    pullResponse = {
      updates: [unversionedCreate('char-a', 'A', 'srv-a')],
      publicFavorites: [],
      serverMaxOperationVersion: 1,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('failed');

    pullResponse = {
      updates: [unversionedCreate('char-b', 'B', 'srv-b')],
      publicFavorites: [],
      serverMaxOperationVersion: 1,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('failed');

    const counts = (engine as any).pullApply.failureCounts as Map<number | string, number>;
    expect(counts.get('srv-a')).toBe(1);
    expect(counts.get('srv-b')).toBe(1);
    expect(counts.has(0)).toBe(false);
  });

  it('falls back to key 0 only when the update carries no identity at all', async () => {
    await seedStory();
    poisonCreates();
    pullResponse = {
      updates: [unversionedCreate('char-n', 'N')],
      publicFavorites: [],
      serverMaxOperationVersion: 1,
      role: 'owner',
    };

    await expect(runOneCycle()).resolves.toBe('failed');

    expect((engine as any).pullApply.failureCounts.get(0)).toBe(1);
  });
});

describe('apply and record atomicity', () => {
  const readScene = (id: string) =>
    database.db.query.scenes.findFirst({ where: eq(schema.scenes.id, id) });

  it('rolls the apply back when the record fails, and bumps versions exactly once on recovery', async () => {
    await seedStory();
    await database.db.insert(schema.scenes).values([
      { id: 'scene-1', storyId: STORY_ID, chapterId: 'chapter-1', name: 'A', index: 0, ...base },
      { id: 'scene-2', storyId: STORY_ID, chapterId: 'chapter-1', name: 'B', index: 1, ...base },
    ]);
    pullResponse = {
      updates: [
        {
          type: 'reorder',
          entity: 'Chapter',
          id: 'chapter-1',
          operationVersion: 4,
          operationId: 'srv-4',
          operationTime: NOW.toISOString(),
          reorderItems: [
            { id: 'scene-1', newIndex: 1 },
            { id: 'scene-2', newIndex: 0 },
          ],
        },
      ],
      publicFavorites: [],
      serverMaxOperationVersion: 4,
      role: 'owner',
    };
    // The apply succeeds but the record does not: without the transaction the reorder's
    // version bumps would stay while the cursor holds, and the retry would bump them again.
    const record = jest
      .spyOn((engine as any).pull, 'recordRemoteOperationLocally')
      .mockRejectedValueOnce(new Error('disco cheio'));

    await expect(runOneCycle()).resolves.toBe('failed');

    expect(await readScene('scene-1')).toMatchObject({ index: 0, version: 1 });
    expect(await readScene('scene-2')).toMatchObject({ index: 1, version: 1 });
    expect((await readStory())!.lastServerSyncedLog).toBe(0);
    record.mockRestore();

    await expect(runOneCycle()).resolves.toBe('ok');

    expect(await readScene('scene-1')).toMatchObject({ index: 1, version: 2 });
    expect(await readScene('scene-2')).toMatchObject({ index: 0, version: 2 });
    expect((await readStory())!.lastServerSyncedLog).toBe(4);
  });
});
