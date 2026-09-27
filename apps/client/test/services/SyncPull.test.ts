/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { MAX_SYNC_PULL_BATCH, type StoryUpdate } from '@keres/shared';
import * as schema from '../../src/db/schema';
import type { OperationLogSelect } from '../../src/db/schema';
import type { ClientSyncEntityHandler } from '../../src/services/entity-sync-handlers/ClientSyncEntityHandler';
import { recordLocalOperation } from '../../src/utils/syncUtils';
import { SyncPull, type FetchRemoteUpdatesInput } from '../../src/services/sync/SyncPull';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');

let database: TestDatabase;
let recordConflict: jest.Mock;
let rebase: jest.Mock;
let pull: SyncPull;
let handler: jest.Mocked<ClientSyncEntityHandler>;

const update = (overrides: Partial<StoryUpdate> = {}): StoryUpdate =>
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

const pending = (
  operationType: OperationLogSelect['operationType'] = 'update',
  payload: Record<string, unknown> = { name: 'Local name', version: 3 },
): OperationLogSelect =>
  ({
    id: `local-${operationType}`,
    storyId: STORY_ID,
    userId: 'local-user',
    operationVersion: 2,
    operationType,
    entityType: 'Character',
    entityId: 'character-1',
    payload: JSON.stringify(payload),
    createdAt: NOW,
    isSynced: false,
    serverOperationVersion: null,
    conflictState: null,
  }) as OperationLogSelect;

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
  recordConflict = jest.fn().mockResolvedValue(undefined);
  rebase = jest.fn().mockResolvedValue(undefined);
  pull = new SyncPull({
    context: {
      db: () => database.db,
      storyId: () => STORY_ID,
      client: jest.fn() as never,
      conflictService: () => ({ recordConflict, refreshServerSnapshot: jest.fn() }) as never,
      abortSignal: () => new AbortController().signal,
      notifier: () =>
        ({
          remoteUpdatesReceived: jest.fn(),
          remoteUpdatesFailed: jest.fn(),
          conflictsDetected: jest.fn(),
          pushedUpdates: jest.fn(),
          pushFailed: jest.fn(),
          syncFailed: jest.fn(),
          protocolMismatch: jest.fn(),
          storyNotFound: jest.fn(),
          message: jest.fn(),
        }) as never,
    },
    rebasePendingOperations: rebase,
  });
  handler = {
    entityName: 'Character',
    setDb: jest.fn(),
    getById: jest.fn(),
    applyCreate: jest.fn(),
    applyUpdate: jest.fn(),
    applyDelete: jest.fn(),
  } as unknown as jest.Mocked<ClientSyncEntityHandler>;
});

afterEach(() => database.close());

describe('echo and create handling', () => {
  it('rejects an update without a server operation version as an echo', async () => {
    await expect(pull.isOwnEchoedOperation(update({ operationVersion: 0 }))).resolves.toBe(false);
  });

  it('recognises a server operation already present in the local log', async () => {
    await database.db.insert(schema.operationLogs).values({
      id: 'already-seen',
      storyId: STORY_ID,
      userId: 'remote-user',
      operationVersion: 1,
      operationType: 'update',
      entityType: 'Character',
      entityId: 'character-1',
      payload: '{}',
      createdAt: NOW,
      isSynced: true,
      serverOperationVersion: 4,
    });

    await expect(pull.isOwnEchoedOperation(update())).resolves.toBe(true);
  });

  it('does not mistake a concurrent operation at the same version for an echo', async () => {
    await database.db.insert(schema.operationLogs).values({
      id: 'already-seen',
      storyId: STORY_ID,
      userId: 'remote-user',
      operationVersion: 1,
      operationType: 'update',
      entityType: 'Character',
      entityId: 'character-1',
      payload: '{}',
      createdAt: NOW,
      isSynced: true,
      serverOperationVersion: 4,
    });

    // Same version, another entity: skipping it would drop someone else's op forever.
    await expect(
      pull.isOwnEchoedOperation(update({ entity: 'Location', id: 'location-9' })),
    ).resolves.toBe(false);
    await expect(pull.isOwnEchoedOperation(update({ id: 'character-2' }))).resolves.toBe(false);
  });

  it('creates a remote entity that is not present locally', async () => {
    handler.getById.mockResolvedValue(undefined);
    const create = update({ type: 'create', data: { name: 'Created' } } as never);

    await pull.applyRemoteCreate(create, handler);

    // The story is stamped into the row: pulled payloads leave it out.
    expect(handler.applyCreate).toHaveBeenCalledWith(STORY_ID, {
      ...create,
      data: { ...(create as { data: Record<string, unknown> }).data, storyId: STORY_ID },
    });
    expect(handler.applyUpdate).not.toHaveBeenCalled();
  });

  it('turns an idempotent repeated create into an update', async () => {
    handler.getById.mockResolvedValue({ id: 'character-1' });
    const create = update({ type: 'create', data: { name: 'Created' }, version: 7 } as never);

    await pull.applyRemoteCreate(create, handler);

    expect(handler.applyUpdate).toHaveBeenCalledWith(
      STORY_ID,
      expect.objectContaining({
        type: 'update',
        changes: expect.objectContaining({ name: 'Created', version: 7 }),
      }),
    );
  });

  it('prefers the entity version carried inside a repeated create payload', async () => {
    handler.getById.mockResolvedValue({ id: 'character-1' });
    const create = update({
      type: 'create',
      data: { name: 'Created', version: 12 },
      version: 7,
    } as never);

    await pull.applyRemoteCreate(create, handler);

    expect(handler.applyUpdate).toHaveBeenCalledWith(
      STORY_ID,
      expect.objectContaining({ changes: expect.objectContaining({ version: 12 }) }),
    );
  });

  it('creates without a lookup when the remote create carries no id', async () => {
    const create = update({ type: 'create', id: undefined, data: { name: 'Created' } } as never);

    await pull.applyRemoteCreate(create, handler);

    expect(handler.getById).not.toHaveBeenCalled();
    // The story is stamped into the row: pulled payloads leave it out.
    expect(handler.applyCreate).toHaveBeenCalledWith(STORY_ID, {
      ...create,
      data: { ...(create as { data: Record<string, unknown> }).data, storyId: STORY_ID },
    });
  });

  it('restarts the version at zero when a repeated create carries none', async () => {
    handler.getById.mockResolvedValue({ id: 'character-1' });
    const create = update({
      type: 'create',
      data: { name: 'Created' },
      version: undefined,
    } as never);

    await pull.applyRemoteCreate(create, handler);

    expect(handler.applyUpdate).toHaveBeenCalledWith(
      STORY_ID,
      expect.objectContaining({ changes: expect.objectContaining({ version: 0 }) }),
    );
  });
});

describe('remote operation log', () => {
  it.each([
    ['create', { data: { name: 'Created' } }, { name: 'Created' }],
    ['update', { changes: { name: 'Changed' } }, { name: 'Changed' }],
    ['delete', {}, { id: 'character-1' }],
  ] as const)('records a %s payload as already synchronized', async (type, fields, expected) => {
    await pull.recordRemoteOperationLocally(update({ type, ...fields } as never));

    const stored = await database.db.query.operationLogs.findFirst({
      where: eq(schema.operationLogs.id, 'remote-op'),
    });
    expect(stored).toMatchObject({ isSynced: true, serverOperationVersion: 4 });
    expect(JSON.parse(stored!.payload)).toEqual(expected);
  });

  it('supplies safe local metadata when an older server omits operation metadata', async () => {
    await pull.recordRemoteOperationLocally(
      update({
        operationId: undefined,
        operationVersion: 0,
        operationTime: undefined,
        originatingUser: undefined,
      }),
    );

    const [stored] = await database.db.query.operationLogs.findMany();
    expect(stored).toMatchObject({
      userId: 'unknown',
      // Local counter (was 0), not the missing server version - one sequence per story.
      operationVersion: 1,
      serverOperationVersion: 0,
    });
    expect(stored.id).toBeTruthy();
    expect(stored.createdAt).toBeInstanceOf(Date);
  });
});

describe('reconciliation decisions', () => {
  it('applies the common deletion when both sides deleted the entity', async () => {
    const result = await pull.reconcileRemoteUpdate(
      update({ type: 'delete' } as never),
      [pending('delete', { isDeleted: true, version: 3 })],
      handler,
    );

    expect(result).toEqual({ conflicted: false });
    expect(handler.applyDelete).toHaveBeenCalled();
    expect(recordConflict).not.toHaveBeenCalled();
  });

  it('preserves a local edit when the server deleted the entity', async () => {
    const result = await pull.reconcileRemoteUpdate(
      update({ type: 'delete' } as never),
      [pending()],
      handler,
    );

    expect(result).toEqual({ conflicted: true });
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'deleted_on_server', clientVersion: 2 }),
    );
  });

  it('preserves a local deletion when the server edited the entity', async () => {
    await pull.reconcileRemoteUpdate(update(), [pending('delete')], handler);

    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'edited_on_server', localOperationType: 'delete' }),
    );
  });

  it('records null versions when neither side sent one', async () => {
    const result = await pull.reconcileRemoteUpdate(
      update({ type: 'delete', version: undefined } as never),
      [pending('update', { name: 'Local name' })],
      handler,
    );

    expect(result).toEqual({ conflicted: true });
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ clientVersion: null, serverVersion: null }),
    );
  });

  /**
   * Fail-closed like the batch applier: an operation type this build has never heard of carries
   * no interpretable values, so rebasing onto it would silently advance past the unknown
   * operation. The applier stops such updates before dispatch; reconcile refuses them too, so
   * no future direct caller can reintroduce the lenient path.
   */
  it('refuses to reconcile a remote operation type it does not know', async () => {
    const local = pending();

    await expect(
      pull.reconcileRemoteUpdate(update({ type: 'teleport' } as never), [local], handler),
    ).rejects.toThrow('cannot reconcile remote operation type');

    expect(handler.applyUpdate).not.toHaveBeenCalled();
    expect(recordConflict).not.toHaveBeenCalled();
    expect(rebase).not.toHaveBeenCalled();
  });

  it('applies disjoint server fields and rebases the local operation without a prompt', async () => {
    const local = pending('update', { summary: 'Local summary', version: 3 });

    const result = await pull.reconcileRemoteUpdate(update(), [local], handler);

    expect(result).toEqual({ conflicted: false });
    expect(handler.applyUpdate).toHaveBeenCalledWith(
      STORY_ID,
      expect.objectContaining({ changes: { name: 'Server name' } }),
    );
    expect(rebase).toHaveBeenCalledWith([local], 4);
  });

  it('records overlapping fields as one concurrent-edit conflict', async () => {
    const result = await pull.reconcileRemoteUpdate(update(), [pending()], handler);

    expect(result).toEqual({ conflicted: true });
    expect(handler.applyUpdate).not.toHaveBeenCalled();
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'concurrent_edit', localOperationIds: ['local-update'] }),
    );
  });

  it('classifies a pending local create correctly', async () => {
    await pull.reconcileRemoteUpdate(
      update({ type: 'create', data: { name: 'Server name' } } as never),
      [pending('create')],
      handler,
    );

    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ localOperationType: 'create' }),
    );
  });

  /**
   * A place is a row's rank, written like any field - and the last move to land is the row's place
   * everywhere. The pending local rank reaches the server after the remote one, so the remote rank
   * never overwrites it here and never asks anything; the rest of the remote edit merges.
   */
  it('keeps a pending local rank over a remote one, merging the rest without a prompt', async () => {
    const local = { ...pending('update', { rank: 'a3', version: 3 }), entityType: 'Scene' };

    const result = await pull.reconcileRemoteUpdate(
      update({ entity: 'Scene', changes: { rank: 'a7', name: 'Server name' } } as never),
      [local],
      handler,
    );

    expect(result).toEqual({ conflicted: false });
    expect(handler.applyUpdate).toHaveBeenCalledWith(
      STORY_ID,
      expect.objectContaining({ changes: { name: 'Server name' } }),
    );
    expect(rebase).toHaveBeenCalledWith([local], 4);
    expect(recordConflict).not.toHaveBeenCalled();
  });

  it('keeps deleting a row the server only moved', async () => {
    const local = {
      ...pending('delete', { isDeleted: true, version: 3 }),
      entityType: 'Scene',
    };

    const result = await pull.reconcileRemoteUpdate(
      update({ entity: 'Scene', changes: { rank: 'a7', chapterId: 'chapter-2' } } as never),
      [local],
      handler,
    );

    expect(result).toEqual({ conflicted: false });
    expect(rebase).toHaveBeenCalledWith([local], 4);
    expect(recordConflict).not.toHaveBeenCalled();
  });

  it('lets the deletion of a row land over a pending move of it, dropping the move', async () => {
    await recordLocalOperation(database.db, STORY_ID, 'local-user', 'update', 'Scene', 'scene-1', {
      rank: 'a3',
      version: 3,
    });
    const [local] = await database.db.query.operationLogs.findMany();

    const result = await pull.reconcileRemoteUpdate(
      update({ entity: 'Scene', id: 'scene-1', type: 'delete' } as never),
      [local!],
      handler,
    );

    expect(result).toEqual({ conflicted: false });
    expect(handler.applyDelete).toHaveBeenCalled();
    expect(recordConflict).not.toHaveBeenCalled();
    expect(
      await database.db.query.operationLogs.findFirst({
        where: eq(schema.operationLogs.id, local!.id),
      }),
    ).toMatchObject({ isSynced: true, conflictState: 'abandoned' });
  });

  it('still asks when the server deleted a row whose content was edited here', async () => {
    const result = await pull.reconcileRemoteUpdate(
      update({ entity: 'Scene', type: 'delete' } as never),
      [{ ...pending('update', { name: 'Local', rank: 'a3', version: 3 }), entityType: 'Scene' }],
      handler,
    );

    expect(result).toEqual({ conflicted: true });
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'deleted_on_server' }),
    );
  });

  it('never records the derived position in a conflict snapshot', async () => {
    await pull.reconcileRemoteUpdate(
      update({ entity: 'Scene', changes: { name: 'Server name', index: 4 } } as never),
      [{ ...pending(), entityType: 'Scene' }],
      handler,
    );

    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ serverValues: { name: 'Server name' } }),
    );
  });
});

describe('fetching remote updates', () => {
  const page = (overrides: Record<string, unknown> = {}) => ({
    data: { updates: [], serverMaxOperationVersion: 0, role: 'writer', ...overrides },
  });
  const fetchInput = (
    overrides: Partial<FetchRemoteUpdatesInput> = {},
  ): FetchRemoteUpdatesInput => ({
    lastSyncedLog: 0,
    lastPublicFavoriteLog: 0,
    favoriteBehavior: 'individual',
    fallbackRole: 'reader',
    ...overrides,
  });
  function pullWithClient(get: jest.Mock, signal?: AbortSignal) {
    return new SyncPull({
      context: {
        db: () => database.db,
        storyId: () => STORY_ID,
        client: () => ({ get }) as never,
        conflictService: () => ({ recordConflict, refreshServerSnapshot: jest.fn() }) as never,
        abortSignal: () => signal ?? new AbortController().signal,
        notifier: () => ({}) as never,
      },
      rebasePendingOperations: rebase,
    });
  }

  it('follows full pages until an incomplete one, advancing the cursor', async () => {
    const firstPage = Array.from({ length: MAX_SYNC_PULL_BATCH }, (_, index) =>
      update({ operationVersion: index + 1 }),
    );
    const get = jest
      .fn()
      .mockResolvedValueOnce(page({ updates: firstPage }))
      .mockResolvedValueOnce(page({ updates: [update({ operationVersion: 501 })] }));
    const fetcher = pullWithClient(get);

    const result = await fetcher.fetchRemoteUpdates(fetchInput());

    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0][0]).toContain('lastOperationVersion=0');
    expect(get.mock.calls[1][0]).toContain('lastOperationVersion=500');
    expect(result.updates).toHaveLength(MAX_SYNC_PULL_BATCH + 1);
    expect(result.role).toBe('writer');
  });

  it('sends the favorites fingerprint only for public stories', async () => {
    const get = jest.fn().mockResolvedValue(page());
    const fetcher = pullWithClient(get);

    await fetcher.fetchRemoteUpdates(fetchInput({ favoriteBehavior: 'individual_public' }));
    expect(get.mock.calls[0][0]).toContain('favoritesCount=0&favoritesMaxVersion=0');

    get.mockClear();
    await fetcher.fetchRemoteUpdates(fetchInput({ favoriteBehavior: 'individual' }));
    expect(get.mock.calls[0][0]).not.toContain('favoritesCount=');
  });

  it('adopts the server fingerprint for the following pages', async () => {
    const fullPage = Array.from({ length: MAX_SYNC_PULL_BATCH }, (_, index) =>
      update({ operationVersion: index + 1 }),
    );
    const get = jest
      .fn()
      .mockResolvedValueOnce(
        page({ updates: fullPage, favoritesFingerprint: { count: 5, maxVersion: 9 } }),
      )
      .mockResolvedValueOnce(page());
    const fetcher = pullWithClient(get);

    await fetcher.fetchRemoteUpdates(fetchInput({ favoriteBehavior: 'individual_public' }));

    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][0]).toContain('favoritesCount=5&favoritesMaxVersion=9');
  });

  it('keeps the fallback role when a page carries none', async () => {
    const get = jest.fn().mockResolvedValue(page({ role: undefined }));
    const fetcher = pullWithClient(get);

    const result = await fetcher.fetchRemoteUpdates(fetchInput({ fallbackRole: 'owner' }));

    expect(result.role).toBe('owner');
  });

  it('throws an abort error when the cycle was stopped', async () => {
    const controller = new AbortController();
    controller.abort();
    const get = jest.fn().mockResolvedValue(page());
    const fetcher = pullWithClient(get, controller.signal);

    await expect(fetcher.fetchRemoteUpdates(fetchInput())).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(get).not.toHaveBeenCalled();
  });

  it('stops at maxPages and logs the remaining backlog instead of paging forever', async () => {
    const fullPage = (base: number) =>
      Array.from({ length: MAX_SYNC_PULL_BATCH }, (_, index) =>
        update({ operationVersion: base + index }),
      );
    const get = jest
      .fn()
      .mockResolvedValueOnce(page({ updates: fullPage(1) }))
      .mockResolvedValueOnce(page({ updates: fullPage(501) }))
      .mockResolvedValueOnce(page({ updates: fullPage(1001) }));
    const fetcher = pullWithClient(get);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await fetcher.fetchRemoteUpdates(fetchInput({ maxPages: 2 }));

    expect(get).toHaveBeenCalledTimes(2);
    expect(result.updates).toHaveLength(MAX_SYNC_PULL_BATCH * 2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2-page ceiling'));
    logSpy.mockRestore();
  });

  it('advances the favorites cursor per page instead of refetching the same rows', async () => {
    const firstPage = Array.from({ length: MAX_SYNC_PULL_BATCH }, (_, index) =>
      update({ operationVersion: index + 1 }),
    );
    const favorite = (operationVersion: number) =>
      update({ entity: 'Favorite', id: `fav-${operationVersion}`, operationVersion });
    const get = jest
      .fn()
      .mockResolvedValueOnce(page({ updates: [...firstPage, favorite(501), favorite(502)] }))
      .mockResolvedValueOnce(page({ updates: [update({ operationVersion: 503 })] }));
    const fetcher = pullWithClient(get);

    const result = await fetcher.fetchRemoteUpdates(fetchInput());

    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][0]).toContain('lastOperationVersion=502');
    expect(get.mock.calls[1][0]).toContain('lastPublicFavoriteVersion=502');
    expect(result.updates).toHaveLength(MAX_SYNC_PULL_BATCH + 3);
    const favoriteIds = result.updates
      .filter((entry) => entry.entity === 'Favorite')
      .map((entry) => entry.id);
    expect(new Set(favoriteIds).size).toBe(favoriteIds.length);
  });

  it('stays silent when the last allowed page proves the backlog is drained', async () => {
    const fullPage = Array.from({ length: MAX_SYNC_PULL_BATCH }, (_, index) =>
      update({ operationVersion: index + 1 }),
    );
    const get = jest
      .fn()
      .mockResolvedValueOnce(page({ updates: fullPage }))
      .mockResolvedValueOnce(page({ updates: [update({ operationVersion: 501 })] }));
    const fetcher = pullWithClient(get);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await fetcher.fetchRemoteUpdates(fetchInput({ maxPages: 2 }));

    expect(get).toHaveBeenCalledTimes(2);
    expect(result.updates).toHaveLength(MAX_SYNC_PULL_BATCH + 1);
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('-page ceiling'));
    logSpy.mockRestore();
  });
});

describe('remote record numbering', () => {
  it('numbers recorded remote ops from the local counter, keeping the server version aside', async () => {
    await pull.recordRemoteOperationLocally(update({ operationId: 'srv-4', operationVersion: 4 }));

    const stored = await database.db.query.operationLogs.findFirst({
      where: eq(schema.operationLogs.id, 'srv-4'),
    });
    // Local space (counter was 0), not the server's 4 - the two sequences must never share
    // the column, or local writes collide with recorded rows once past the import point.
    expect(stored).toMatchObject({ operationVersion: 1, serverOperationVersion: 4 });
    expect(
      (await database.db.query.stories.findFirst({
        where: eq(schema.stories.id, STORY_ID),
      }))!.lastOperationLog,
    ).toBe(1);
  });

  it('keeps one dense sequence when local writes interleave with recorded remote ops', async () => {
    await recordLocalOperation(
      database.db,
      STORY_ID,
      'local-user',
      'update',
      'Character',
      'character-1',
      {
        name: 'Local',
        version: 2,
      },
    );
    await pull.recordRemoteOperationLocally(update({ operationId: 'srv-9', operationVersion: 9 }));
    await recordLocalOperation(
      database.db,
      STORY_ID,
      'local-user',
      'update',
      'Character',
      'character-1',
      {
        name: 'Local again',
        version: 3,
      },
    );

    const rows = await database.db.query.operationLogs.findMany({
      columns: { operationVersion: true, serverOperationVersion: true },
    });
    expect(rows.map((row) => row.operationVersion).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(rows.find((row) => row.operationVersion === 2)).toMatchObject({
      serverOperationVersion: 9,
    });
  });
});

describe('pending payloads that parse to a non-object value', () => {
  it('records the conflict without a client version instead of crashing', async () => {
    const nil = pending('update', {});
    nil.id = 'local-nil';
    nil.payload = 'null';
    const num = pending('update', {});
    num.id = 'local-num';
    num.payload = '5';

    for (const op of [nil, num]) {
      const result = await pull.reconcileRemoteUpdate(
        update({ changes: { name: 'Server', version: 4 } }),
        [op],
        handler,
      );
      expect(result).toEqual({ conflicted: false });
    }
    expect(rebase).toHaveBeenCalledTimes(2);
  });
});
