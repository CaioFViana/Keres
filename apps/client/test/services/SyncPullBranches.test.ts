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
let refreshServerSnapshot: jest.Mock;
let rebase: jest.Mock;
let pull: SyncPull;
let handler: jest.Mocked<ClientSyncEntityHandler>;

const update = (overrides: Record<string, unknown> = {}): StoryUpdate =>
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
  overrides: Partial<OperationLogSelect> = {},
): OperationLogSelect =>
  ({
    id: `local-${operationType}`,
    storyId: STORY_ID,
    userId: 'local-user',
    operationVersion: 2,
    operationType,
    entityType: 'Character',
    entityId: 'character-1',
    payload: JSON.stringify({ name: 'Local name', version: 3 }),
    createdAt: NOW,
    isSynced: false,
    serverOperationVersion: null,
    conflictState: null,
    ...overrides,
  }) as OperationLogSelect;

const seedCharacter = (overrides: Record<string, unknown> = {}) =>
  database.db.insert(schema.characters).values({
    id: 'character-1',
    storyId: STORY_ID,
    name: 'Local name',
    createdAt: NOW,
    updatedAt: NOW,
    version: 3,
    isDeleted: false,
    ...overrides,
  } as never);

const characterRow = () =>
  database.db.select().from(schema.characters).where(eq(schema.characters.id, 'character-1')).get();

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
  refreshServerSnapshot = jest.fn().mockResolvedValue(undefined);
  rebase = jest.fn().mockResolvedValue(undefined);
  pull = new SyncPull({
    context: {
      db: () => database.db,
      storyId: () => STORY_ID,
      client: jest.fn() as never,
      conflictService: () => ({ recordConflict, refreshServerSnapshot }) as never,
      abortSignal: () => new AbortController().signal,
      notifier: () => ({}) as never,
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
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('foldVersionIntoConflicts', () => {
  it('ignores an update that names no entity', async () => {
    await expect(pull.foldVersionIntoConflicts(update({ id: undefined }))).resolves.toBeUndefined();
  });
});

describe('a push answer that never arrived', () => {
  const seedLost = (conflictState: 'conflicted' | null) =>
    database.db.insert(schema.operationLogs).values({
      ...pending('update', { id: 'lost', conflictState }),
      operationVersion: 1,
    });

  it('settles the operation and closes the conflict that held it', async () => {
    await seedLost('conflicted');
    await database.db.insert(schema.syncConflicts).values({
      id: 'held',
      storyId: STORY_ID,
      entityType: 'Character',
      entityId: 'character-1',
      reason: 'concurrent_edit',
      localOperationType: 'update',
      localOperationIds: JSON.stringify(['lost']),
      localValues: '{}',
      status: 'pending',
      detectedAt: NOW,
    } as never);

    await expect(pull.isOwnEchoedOperation(update({ clientOperationId: 'lost' }))).resolves.toBe(
      true,
    );

    const conflict = await database.db.query.syncConflicts.findFirst({
      where: eq(schema.syncConflicts.id, 'held'),
    });
    expect(conflict).toMatchObject({ status: 'resolved', resolution: 'keep_local' });
  });

  it('settles a held operation that no conflict lists', async () => {
    await seedLost('conflicted');

    await expect(pull.isOwnEchoedOperation(update({ clientOperationId: 'lost' }))).resolves.toBe(
      true,
    );
  });

  it('does not claim an operation this device never queued', async () => {
    await expect(
      pull.isOwnEchoedOperation(update({ clientOperationId: 'stranger' })),
    ).resolves.toBe(false);
  });
});

describe('applyRemoteCreate of a row already here', () => {
  it('writes the version 0 when neither the data nor the update carry one', async () => {
    handler.getById.mockResolvedValue({ id: 'character-1' });

    await pull.applyRemoteCreate(
      update({ type: 'create', data: undefined, version: undefined }),
      handler,
    );

    expect(handler.applyUpdate).toHaveBeenCalledWith(
      STORY_ID,
      expect.objectContaining({ changes: { version: 0 } }),
    );
  });

  it('creates through the handler when the update names no id', async () => {
    await pull.applyRemoteCreate(
      update({ type: 'create', id: undefined, data: { name: 'New' } }),
      handler,
    );

    expect(handler.getById).not.toHaveBeenCalled();
    expect(handler.applyCreate).toHaveBeenCalledTimes(1);
  });

  it('hands an entity without a story column the create as it came', async () => {
    const create = update({ type: 'create', entity: 'Story', id: 'story-2', data: { title: 'T' } });

    await pull.applyRemoteCreate(create, handler);

    expect(handler.applyCreate).toHaveBeenCalledWith(STORY_ID, create);
  });
});

describe('applyRemoteDelete', () => {
  it('only lets the handler flip the flags for an entity without a table', async () => {
    await pull.applyRemoteDelete(update({ type: 'delete', entity: 'Nope' }) as never, handler);
    expect(handler.applyDelete).toHaveBeenCalledTimes(1);
  });

  it('leaves the row alone when the deletion carries neither content nor version', async () => {
    await seedCharacter();

    await pull.applyRemoteDelete(
      update({ type: 'delete', data: undefined, version: undefined }) as never,
      handler,
    );

    expect(await characterRow()).toMatchObject({ name: 'Local name', version: 3 });
  });

  it('takes the content of the tombstone even when the deletion carries no version', async () => {
    await seedCharacter();

    await pull.applyRemoteDelete(
      update({ type: 'delete', data: { name: 'Server tomb' }, version: undefined }) as never,
      handler,
    );

    expect(await characterRow()).toMatchObject({ name: 'Server tomb', version: 3 });
  });

  it('skips the tombstone when the update names no id', async () => {
    await pull.applyRemoteDelete(update({ type: 'delete', id: undefined }) as never, handler);
    expect(handler.applyDelete).toHaveBeenCalledTimes(1);
  });
});

describe('alignEchoedWholeRow', () => {
  it('ignores a deletion without the tombstone', async () => {
    await pull.alignEchoedWholeRow(update({ type: 'delete', data: undefined }), handler);
    expect(handler.applyDelete).not.toHaveBeenCalled();
  });

  it('applies the tombstone a deletion carries', async () => {
    await seedCharacter();
    await pull.alignEchoedWholeRow(
      update({ type: 'delete', data: { name: 'Server tomb' } }),
      handler,
    );
    expect(handler.applyDelete).toHaveBeenCalledTimes(1);
    expect((await characterRow())!.name).toBe('Server tomb');
  });

  it('ignores an operation type it cannot read values from', async () => {
    await pull.alignEchoedWholeRow(update({ type: 'teleport' } as never), handler);
    expect(handler.getById).not.toHaveBeenCalled();
  });

  it('does nothing for an echoed create without data or a local row', async () => {
    handler.getById.mockResolvedValue(undefined);
    await pull.alignEchoedWholeRow(update({ type: 'create', data: undefined }), handler);
    await pull.alignEchoedWholeRow(
      update({ type: 'update', changes: undefined, id: undefined }),
      handler,
    );
    expect(handler.getById).toHaveBeenCalledWith('');
    expect(handler.applyUpdate).not.toHaveBeenCalled();
  });

  it('writes only the fields the server normalized', async () => {
    handler.getById.mockResolvedValue({ id: 'character-1', name: 'Local', title: 'Same' });

    await pull.alignEchoedWholeRow(
      update({ type: 'create', data: { name: 'Server', title: 'Same', version: 4, extra: 1 } }),
      handler,
    );

    expect(handler.applyUpdate).toHaveBeenCalledWith(
      STORY_ID,
      expect.objectContaining({ changes: { name: 'Server' } }),
    );
  });

  it('writes nothing when the row already matches', async () => {
    handler.getById.mockResolvedValue({ id: 'character-1', name: 'Server name' });
    await pull.alignEchoedWholeRow(update(), handler);
    expect(handler.applyUpdate).not.toHaveBeenCalled();
  });
});

describe('reconcileRemoteUpdate', () => {
  it('lets both deleting sides settle and refreshes an open conflict without a server version', async () => {
    const held = pending('update', { id: 'held', conflictState: 'conflicted' });

    const result = await pull.reconcileRemoteUpdate(
      update({ type: 'delete', data: undefined, version: undefined }),
      [pending('delete'), held],
      handler,
    );

    expect(result).toEqual({ conflicted: false });
    expect(refreshServerSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ serverVersion: null, serverValues: { isDeleted: true } }),
    );
  });

  it('records the tombstone conflict of a deletion that carries no version', async () => {
    const result = await pull.reconcileRemoteUpdate(
      update({ type: 'delete', data: undefined, version: undefined }),
      [pending('update', { payload: JSON.stringify({ name: 'Local', version: 3 }) })],
      handler,
    );

    expect(result).toEqual({ conflicted: true });
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'deleted_on_server', serverVersion: null }),
    );
  });

  it('records a conflict without a client version when the local payload cannot be read', async () => {
    const result = await pull.reconcileRemoteUpdate(
      update({ type: 'delete' }),
      [pending('update', { payload: '{nope' })],
      handler,
    );

    expect(result).toEqual({ conflicted: true });
    expect(recordConflict).toHaveBeenCalledWith(expect.objectContaining({ clientVersion: null }));
  });

  it('falls back to the in-memory base when the operation row is gone', async () => {
    await pull.reconcileRemoteUpdate(
      update({ type: 'delete' }),
      [pending('update', { payload: JSON.stringify({ name: 'Local', version: 3 }) })],
      handler,
    );

    expect(recordConflict).toHaveBeenCalledWith(expect.objectContaining({ clientVersion: 2 }));
  });

  it('records a conflict with no local operation at all', async () => {
    const result = await pull.reconcileRemoteUpdate(update({ type: 'delete' }), [], handler);

    expect(result).toEqual({ conflicted: true });
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ clientVersion: null, localOperationType: 'update' }),
    );
  });

  it('gives a place-only edit against a local deletion no new place when it only carries a version', async () => {
    const result = await pull.reconcileRemoteUpdate(
      update({ changes: { version: 4 } }),
      [pending('delete', { payload: JSON.stringify({ isDeleted: true, version: 3 }) })],
      handler,
    );

    expect(result).toEqual({ conflicted: false });
    expect(handler.applyUpdate).not.toHaveBeenCalled();
  });

  it('does not rebase onto a remote update that names no version', async () => {
    const result = await pull.reconcileRemoteUpdate(
      update({ version: undefined, changes: { version: 4 } }),
      [pending('delete', { payload: JSON.stringify({ isDeleted: true, version: 3 }) })],
      handler,
    );

    expect(result).toEqual({ conflicted: false });
    expect(rebase).not.toHaveBeenCalled();
  });
});
