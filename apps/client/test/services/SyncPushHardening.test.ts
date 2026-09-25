/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import type { StoryUpdate } from '@keres/shared';
import * as schema from '../../src/db/schema';
import type { OperationLogSelect } from '../../src/db/schema';
import type { ClientSyncEntityHandler } from '../../src/services/entity-sync-handlers/ClientSyncEntityHandler';
import type { SyncNotifier } from '../../src/services/sync/SyncNotifier';
import { SyncPull } from '../../src/services/sync/SyncPull';
import { SyncPush } from '../../src/services/sync/SyncPush';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');

let database: TestDatabase;
let post: jest.Mock;
let recordConflict: jest.Mock;
let push: SyncPush;
let pull: SyncPull;
let notifier: jest.Mocked<SyncNotifier>;
let handler: jest.Mocked<ClientSyncEntityHandler>;

const operation = (
  id: string,
  operationType: OperationLogSelect['operationType'],
  overrides: Partial<OperationLogSelect> = {},
): OperationLogSelect =>
  ({
    id,
    storyId: STORY_ID,
    userId: 'local-user',
    operationVersion: 1,
    operationType,
    entityType: 'Character',
    entityId: 'character-1',
    payload: JSON.stringify({ name: 'Local', version: 2 }),
    createdAt: NOW,
    isSynced: false,
    serverOperationVersion: null,
    conflictState: null,
    ...overrides,
  }) as OperationLogSelect;

const remoteUpdate = (overrides: Partial<StoryUpdate> = {}): StoryUpdate =>
  ({
    operationId: 'remote-op',
    operationVersion: 4,
    operationTime: NOW.toISOString(),
    originatingUser: 'remote-user',
    type: 'update',
    entity: 'Character',
    id: 'character-1',
    version: 4,
    changes: { name: 'Server name' },
    ...overrides,
  }) as StoryUpdate;

async function seedOperation(value: OperationLogSelect) {
  await database.db.insert(schema.operationLogs).values(value);
}

const readOperation = (id: string) =>
  database.db.query.operationLogs.findFirst({ where: eq(schema.operationLogs.id, id) });

beforeEach(async () => {
  database = await createTestDatabase();
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'Story',
    type: 'linear',
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted: false,
  });
  post = jest.fn();
  recordConflict = jest.fn().mockResolvedValue(undefined);
  notifier = {
    remoteUpdatesReceived: jest.fn(),
    remoteUpdatesFailed: jest.fn(),
    conflictsDetected: jest.fn(),
    pushedUpdates: jest.fn(),
    pushFailed: jest.fn(),
    syncFailed: jest.fn(),
    protocolMismatch: jest.fn(),
    storyNotFound: jest.fn(),
    message: jest.fn(),
  };
  push = new SyncPush({
    db: () => database.db,
    storyId: () => STORY_ID,
    client: () => ({ post }) as never,
    conflictService: () => ({ recordConflict }) as never,
    notifier: () => notifier,
    abortSignal: () => new AbortController().signal,
  });
  pull = new SyncPull({
    context: {
      db: () => database.db,
      storyId: () => STORY_ID,
      client: jest.fn() as never,
      conflictService: () => ({ recordConflict }) as never,
      abortSignal: () => new AbortController().signal,
      notifier: () => notifier,
    },
    rebasePendingOperations: (operations, version) =>
      push.rebasePendingOperations(operations, version),
  });
  handler = {
    entityName: 'Character',
    setDb: jest.fn(),
    getById: jest.fn(),
    applyCreate: jest.fn(),
    applyUpdate: jest.fn(),
    applyDelete: jest.fn(),
  } as unknown as jest.Mocked<ClientSyncEntityHandler>;
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('quarantining unpushable operations', () => {
  it('turns an update without a version into a visible conflict and takes it out of the queue', async () => {
    await seedOperation(
      operation('unsafe', 'update', { payload: JSON.stringify({ name: 'Missing base' }) }),
    );

    await expect(push.pushPendingOperations()).resolves.toEqual({ offline: false });

    expect(post).not.toHaveBeenCalled();
    expect(recordConflict).toHaveBeenCalledTimes(1);
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'Character',
        entityId: 'character-1',
        reason: 'validation',
        localOperationType: 'update',
        localOperationIds: ['unsafe'],
        localValues: { name: 'Missing base' },
        serverValues: null,
        clientVersion: null,
        message: expect.stringContaining('no version'),
      }),
    );
    expect(await readOperation('unsafe')).toMatchObject({
      isSynced: false,
      conflictState: 'conflicted',
    });
    expect(await push.getPendingOperationsByEntity()).toEqual(new Map());
    expect(notifier.conflictsDetected).toHaveBeenCalledWith(1);
  });

  it('quarantines a corrupted payload without aborting the push of the other operations', async () => {
    await seedOperation(operation('corrupt', 'update', { payload: '{not-json' }));
    await seedOperation(operation('valid', 'update', { operationVersion: 2 }));
    post.mockResolvedValue({
      data: {
        applied: [{ clientOperationId: 'valid', operationVersion: 3 }],
        conflicts: [],
      },
    });

    await expect(push.pushPendingOperations()).resolves.toEqual({ offline: false });

    // The valid op still went out alone and landed.
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toHaveLength(1);
    expect(await readOperation('valid')).toMatchObject({ isSynced: true });
    // The corrupted one is parked visibly, with empty values and the parse failure noted.
    expect(await readOperation('corrupt')).toMatchObject({
      isSynced: false,
      conflictState: 'conflicted',
    });
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'validation',
        localOperationIds: ['corrupt'],
        localValues: {},
        message: expect.stringContaining('could not be parsed'),
      }),
    );
    expect(notifier.pushedUpdates).toHaveBeenCalledWith(1);
    expect(notifier.conflictsDetected).toHaveBeenCalledWith(1);
  });
});

describe('rebasing around corrupted payloads', () => {
  it('skips an unreadable op without dropping the rebase of the rest', async () => {
    const valid = operation('valid', 'update', {
      payload: JSON.stringify({ name: 'Local', version: 2 }),
    });
    const corrupt = operation('corrupt', 'update', {
      operationVersion: 2,
      payload: 'not-json{',
    });
    await seedOperation(valid);
    await seedOperation(corrupt);
    await database.db.insert(schema.characters).values({
      id: 'character-1',
      storyId: STORY_ID,
      name: 'Local',
      createdAt: NOW,
      updatedAt: NOW,
      version: 2,
      isDeleted: false,
    });

    await expect(push.rebasePendingOperations([valid, corrupt], 8)).resolves.toBeUndefined();

    // The valid op chains onto the server version; the corrupted row is untouched.
    expect(JSON.parse((await readOperation('valid'))!.payload).version).toBe(9);
    expect((await readOperation('corrupt'))!.payload).toBe('not-json{');
    // The row follows the chain's end counting only the rewritten ops.
    expect(await database.db.query.characters.findFirst()).toMatchObject({ version: 9 });
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('conflict versions within one pull batch', () => {
  it('records the rebased client version when two remote updates hit the same entity', async () => {
    const seeded = operation('local-1', 'update', {
      payload: JSON.stringify({ summary: 'Local summary', version: 3 }),
    });
    await seedOperation(seeded);
    // The engine hands every update in the batch the same snapshot; the rebase below only
    // rewrites the database, so this object stays stale on purpose.
    const snapshot = (await readOperation('local-1'))!;

    const merged = await pull.reconcileRemoteUpdate(
      remoteUpdate({
        operationVersion: 4,
        version: 4,
        changes: { name: 'Server name', version: 4 },
      }),
      [snapshot],
      handler,
    );
    expect(merged).toEqual({ conflicted: false });
    expect(handler.applyUpdate).toHaveBeenCalledWith(
      STORY_ID,
      expect.objectContaining({ changes: { name: 'Server name', version: 4 } }),
    );

    const conflicted = await pull.reconcileRemoteUpdate(
      remoteUpdate({
        operationId: 'remote-op-2',
        operationVersion: 5,
        version: 5,
        changes: { summary: 'Server summary', version: 5 },
      }),
      [snapshot],
      handler,
    );

    expect(conflicted).toEqual({ conflicted: true });
    // The first update rebased the op to version 5 (base 4); the stale snapshot still says base 2.
    expect(recordConflict).toHaveBeenCalledTimes(1);
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'concurrent_edit', clientVersion: 4 }),
    );
  });

  it('records a conflict with a null client version when the pending payload is corrupted', async () => {
    const corrupt = operation('corrupt', 'update', { payload: '{not-json' });
    await seedOperation(corrupt);

    const result = await pull.reconcileRemoteUpdate(
      remoteUpdate({ type: 'delete' } as never),
      [corrupt],
      handler,
    );

    expect(result).toEqual({ conflicted: true });
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'deleted_on_server', clientVersion: null }),
    );
    expect(console.warn).toHaveBeenCalled();
  });

  it('conflicts a remote reorder against a corrupted pending reorder with an empty local order', async () => {
    const corrupt = operation('corrupt-reorder', 'reorder', {
      entityType: 'Chapter',
      entityId: 'chapter-1',
      payload: '{not-json',
    });

    const result = await pull.reconcileRemoteUpdate(
      remoteUpdate({
        type: 'reorder',
        entity: 'Chapter',
        id: 'chapter-1',
        reorderItems: [{ id: 'scene-server', newIndex: 1 }],
      } as never),
      [corrupt],
      handler,
    );

    expect(result).toEqual({ conflicted: true });
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'concurrent_edit',
        localOperationType: 'reorder',
        localValues: { reorderItems: [] },
        clientVersion: null,
      }),
    );
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('payload shapes that cannot be pushed', () => {
  it('quarantines payloads that parse to a non-object value', async () => {
    await seedOperation(operation('num', 'update', { payload: '5' }));
    await seedOperation(operation('nil', 'update', { operationVersion: 2, payload: 'null' }));
    await seedOperation(operation('str', 'update', { operationVersion: 3, payload: '"str"' }));

    await expect(push.pushPendingOperations()).resolves.toEqual({ offline: false });

    expect(post).not.toHaveBeenCalled();
    expect(recordConflict).toHaveBeenCalledTimes(3);
    expect(await push.getPendingOperationsByEntity()).toEqual(new Map());
  });

  it('records the quarantine under each operation kind', async () => {
    await seedOperation(
      operation('no-id', 'create', { entityId: '', payload: JSON.stringify({ name: 'X' }) }),
    );
    await seedOperation(
      operation('no-version', 'delete', {
        operationVersion: 2,
        payload: JSON.stringify({ name: 'X' }),
      }),
    );
    await seedOperation(
      operation('bad-reorder', 'reorder', {
        operationVersion: 3,
        payload: JSON.stringify({ name: 'X', version: 2 }),
      }),
    );
    await seedOperation(
      operation('unknown-kind', 'migrate' as never, {
        operationVersion: 4,
        payload: JSON.stringify({ name: 'X', version: 2 }),
      }),
    );

    await expect(push.pushPendingOperations()).resolves.toEqual({ offline: false });

    expect(post).not.toHaveBeenCalled();
    const kinds = recordConflict.mock.calls.map(
      (call) => (call[0] as { localOperationType: string }).localOperationType,
    );
    expect(kinds.sort()).toEqual(['create', 'delete', 'reorder', 'update']);
    expect(await push.getPendingOperationsByEntity()).toEqual(new Map());
  });
});

describe('push round ceiling', () => {
  it('logs the ceiling and defers the rest when the backlog exceeds maxRounds', async () => {
    const ops = Array.from({ length: 401 }, (_, index) =>
      operation(`bulk-${index}`, 'update', {
        operationVersion: index + 1,
        entityId: `character-${index}`,
      }),
    );
    for (const op of ops) await seedOperation(op);
    post.mockImplementation(async (_url: string, body: { clientOperationId?: string }[]) => ({
      data: {
        applied: body.map((entry, index) => ({
          clientOperationId: entry.clientOperationId,
          operationVersion: index + 1,
        })),
        conflicts: [],
      },
    }));
    const capped = new SyncPush(
      {
        db: () => database.db,
        storyId: () => STORY_ID,
        client: () => ({ post }) as never,
        conflictService: () => ({ recordConflict }) as never,
        notifier: () => notifier,
        abortSignal: () => new AbortController().signal,
      },
      { maxRounds: 2 },
    );

    await expect(capped.pushPendingOperations()).resolves.toEqual({ offline: false });

    expect(post).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('2-round ceiling'));
    expect((await push.getPendingOperationsByEntity()).size).toBe(1);
  });
});

describe('rebasing around non-object payloads', () => {
  it('skips payloads that parse to a non-object value', async () => {
    const valid = operation('valid', 'update', {
      payload: JSON.stringify({ name: 'Local', version: 2 }),
    });
    const num = operation('num', 'update', { operationVersion: 2, payload: '5' });
    const nil = operation('nil', 'update', { operationVersion: 3, payload: 'null' });
    await seedOperation(valid);
    await seedOperation(num);
    await seedOperation(nil);
    await database.db.insert(schema.characters).values({
      id: 'character-1',
      storyId: STORY_ID,
      name: 'Local',
      createdAt: NOW,
      updatedAt: NOW,
      version: 2,
      isDeleted: false,
    });

    await expect(push.rebasePendingOperations([valid, num, nil], 8)).resolves.toBeUndefined();

    expect(JSON.parse((await readOperation('valid'))!.payload).version).toBe(9);
    expect((await readOperation('num'))!.payload).toBe('5');
    expect((await readOperation('nil'))!.payload).toBe('null');
  });
});
