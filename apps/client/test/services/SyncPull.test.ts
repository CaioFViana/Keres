/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import type { StoryUpdate } from '@keres/shared';
import * as schema from '../../src/db/schema';
import type { OperationLogSelect } from '../../src/db/schema';
import type { ClientSyncEntityHandler } from '../../src/services/entity-sync-handlers/ClientSyncEntityHandler';
import { SyncPull } from '../../src/services/sync/SyncPull';
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
      conflictService: () => ({ recordConflict }) as never,
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

  it('creates a remote entity that is not present locally', async () => {
    handler.getById.mockResolvedValue(undefined);
    const create = update({ type: 'create', data: { name: 'Created' } } as never);

    await pull.applyRemoteCreate(create, handler);

    expect(handler.applyCreate).toHaveBeenCalledWith(STORY_ID, create);
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
});

describe('remote operation log', () => {
  it.each([
    ['create', { data: { name: 'Created' } }, { name: 'Created' }],
    ['update', { changes: { name: 'Changed' } }, { name: 'Changed' }],
    ['delete', {}, { id: 'character-1' }],
    [
      'reorder',
      { reorderItems: [{ id: 'scene-1', newIndex: 1 }] },
      { reorderItems: [{ id: 'scene-1', newIndex: 1 }] },
    ],
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
      operationVersion: 0,
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

  it('records a competing reorder as a whole-order conflict', async () => {
    const reorder = pending('reorder', {
      reorderItems: [{ id: 'scene-local', newIndex: 1 }],
      version: 3,
    });

    const result = await pull.reconcileRemoteUpdate(
      update({
        type: 'reorder',
        entity: 'Chapter',
        id: 'chapter-1',
        reorderItems: [{ id: 'scene-server', newIndex: 1 }],
      } as never),
      [reorder],
      handler,
    );

    expect(result).toEqual({ conflicted: true });
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'concurrent_edit',
        localOperationType: 'reorder',
        localValues: { reorderItems: [{ id: 'scene-local', newIndex: 1 }] },
      }),
    );
  });

  it('applies a remote reorder when the pending edit changes another chapter field', async () => {
    await database.db.insert(schema.chapters).values({
      id: 'chapter-1',
      storyId: STORY_ID,
      name: 'Chapter',
      index: 1,
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      isDeleted: false,
    });
    await database.db.insert(schema.scenes).values([
      {
        id: 'scene-1',
        storyId: STORY_ID,
        chapterId: 'chapter-1',
        locationId: 'location-1',
        name: 'One',
        index: 1,
        createdAt: NOW,
        updatedAt: NOW,
        version: 1,
        isDeleted: false,
      },
      {
        id: 'scene-2',
        storyId: STORY_ID,
        chapterId: 'chapter-1',
        locationId: 'location-1',
        name: 'Two',
        index: 2,
        createdAt: NOW,
        updatedAt: NOW,
        version: 1,
        isDeleted: false,
      },
    ]);

    const result = await pull.reconcileRemoteUpdate(
      update({
        type: 'reorder',
        entity: 'Chapter',
        id: 'chapter-1',
        operationTime: NOW.toISOString(),
        reorderItems: [
          { id: 'scene-2', newIndex: 1 },
          { id: 'scene-1', newIndex: 2 },
        ],
      } as never),
      [pending('update', { name: 'Renamed', version: 3 })],
      handler,
    );

    expect(result).toEqual({ conflicted: false });
    expect(recordConflict).not.toHaveBeenCalled();
    const scenes = await database.db.query.scenes.findMany();
    expect(
      scenes.map(({ id, index }) => ({ id, index })).sort((a, b) => a.index - b.index),
    ).toEqual([
      { id: 'scene-2', index: 1 },
      { id: 'scene-1', index: 2 },
    ]);
  });

  it('uses empty local order and null versions when reorder metadata is absent', async () => {
    await pull.reconcileRemoteUpdate(
      update({
        type: 'reorder',
        entity: 'Chapter',
        id: 'chapter-1',
        version: undefined,
        reorderItems: [],
      } as never),
      [pending('reorder', {})],
      handler,
    );

    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        localValues: { reorderItems: [] },
        clientVersion: null,
        serverVersion: null,
      }),
    );
  });
});
