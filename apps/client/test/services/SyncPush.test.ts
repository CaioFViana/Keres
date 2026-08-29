/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import type { SyncPushResult } from '@keres/shared';
import * as schema from '../../src/db/schema';
import type { OperationLogSelect } from '../../src/db/schema';
import { useNotificationStore } from '../../src/state/notificationStore';
import { SyncPush } from '../../src/services/sync/SyncPush';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');

let database: TestDatabase;
let post: jest.Mock;
let recordConflict: jest.Mock;
let push: SyncPush;
let showNotification: jest.Mock;

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

async function seedOperation(value: OperationLogSelect) {
  await database.db.insert(schema.operationLogs).values(value);
}

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
  push = new SyncPush({
    db: () => database.db,
    storyId: () => STORY_ID,
    client: () => ({ post }) as never,
    conflictService: () => ({ recordConflict }) as never,
  });
  showNotification = jest.fn();
  useNotificationStore.setState({ showNotification });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('operation mapping', () => {
  const build = (value: OperationLogSelect) => (push as any).buildStoryUpdateFromLocalOp(value);

  it('maps create, update and delete envelopes and strips local-only columns', () => {
    const create = build(
      operation('create', 'create', {
        payload: JSON.stringify({
          name: 'Created',
          version: 1,
          storyId: STORY_ID,
          createdAt: NOW.toISOString(),
        }),
      }),
    );
    const update = build(operation('update', 'update'));
    const deletion = build(operation('delete', 'delete'));

    expect(create).toMatchObject({ type: 'create', data: { name: 'Created', version: 1 } });
    expect(create.data).not.toHaveProperty('storyId');
    expect(update).toMatchObject({ type: 'update', version: 1, changes: { version: 1 } });
    expect(deletion).toMatchObject({ type: 'delete', version: 1 });
  });

  it('maps chapter and story reorder payloads', () => {
    const reorderItems = [{ id: 'one', newIndex: 1 }];
    const chapter = build(
      operation('chapter', 'reorder', {
        entityType: 'Chapter',
        entityId: 'chapter-1',
        payload: JSON.stringify({ reorderItems, version: 2 }),
      }),
    );
    const story = build(
      operation('story', 'reorder', {
        entityType: 'Story',
        entityId: STORY_ID,
        payload: JSON.stringify({
          reorderItems,
          reorderTarget: 'schemaFields',
          schemaEntityType: 'Character',
          version: 2,
        }),
      }),
    );

    expect(chapter).toMatchObject({ type: 'reorder', entity: 'Chapter', reorderItems });
    expect(story).toMatchObject({
      type: 'reorder',
      entity: 'Story',
      reorderItems,
      reorderTarget: 'schemaFields',
    });
  });

  it.each([
    operation('missing-version', 'update', { payload: JSON.stringify({ name: 'Invalid' }) }),
    operation('missing-id', 'create', { entityId: '' }),
    operation('bad-reorder', 'reorder', { entityType: 'Character' }),
    operation('unknown', 'rename' as never),
  ])('skips an operation the server cannot safely accept', (value) => {
    expect(build(value)).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('pending operations and rebasing', () => {
  it('groups only pushable operations by entity in operation-version order', async () => {
    await seedOperation(operation('second', 'update', { operationVersion: 2 }));
    await seedOperation(operation('first', 'update', { operationVersion: 1 }));
    await seedOperation(
      operation('blocked', 'update', { operationVersion: 3, conflictState: 'conflicted' }),
    );

    const grouped = await push.getPendingOperationsByEntity();

    expect(grouped.get('Character:character-1')?.map((entry) => entry.id)).toEqual([
      'first',
      'second',
    ]);
  });

  it('chains rebased versions and ignores a missing server version', async () => {
    const first = operation('first', 'update');
    const second = operation('second', 'update');
    await seedOperation(first);
    await seedOperation(second);

    await push.rebasePendingOperations([first, second], undefined);
    expect(
      JSON.parse(
        (await database.db.query.operationLogs.findFirst({
          where: eq(schema.operationLogs.id, 'first'),
        }))!.payload,
      ).version,
    ).toBe(2);

    await push.rebasePendingOperations([first, second], 8);
    const rows = await database.db.query.operationLogs.findMany();
    expect(
      rows.map((row) => JSON.parse(row.payload).version).sort((left, right) => left - right),
    ).toEqual([9, 10]);
  });
});

describe('push result handling', () => {
  it('supports legacy all-or-nothing server responses', async () => {
    const local = operation('legacy', 'update');
    await seedOperation(local);

    const result = await push.applyPushResult({ serverMaxOperationVersion: 9 } as SyncPushResult, [
      local,
    ]);

    expect(result).toEqual({ applied: 1, conflicts: 0 });
    expect(await database.db.query.operationLogs.findFirst()).toMatchObject({
      isSynced: true,
      serverOperationVersion: 9,
    });
  });

  it('marks accepted operations and ignores entries that cannot be correlated', async () => {
    const local = operation('accepted', 'update');
    await seedOperation(local);

    const result = await push.applyPushResult(
      {
        serverMaxOperationVersion: 11,
        applied: [
          { clientOperationId: 'accepted', operationVersion: 10 },
          { operationVersion: 11 },
        ],
        conflicts: [],
      } as unknown as SyncPushResult,
      [local],
      { silent: true },
    );

    expect(result).toEqual({ applied: 2, conflicts: 0 });
    expect(await database.db.query.operationLogs.findFirst()).toMatchObject({
      isSynced: true,
      serverOperationVersion: 10,
    });
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('folds multiple refused operations of one entity into one decision', async () => {
    const first = operation('first', 'update', {
      payload: JSON.stringify({ name: 'A', version: 2 }),
    });
    const second = operation('second', 'delete', {
      operationVersion: 2,
      payload: JSON.stringify({ isDeleted: true, version: 3 }),
    });
    const conflict = {
      entity: 'Character',
      entityId: 'character-1',
      type: 'update',
      reason: 'concurrent_edit',
      message: 'conflict',
      serverEntity: { name: 'Server' },
      serverVersion: 4,
    };

    const result = await push.applyPushResult(
      { applied: [], conflicts: [conflict, { ...conflict, message: 'again' }] } as never,
      [first, second],
    );

    expect(result).toEqual({ applied: 0, conflicts: 1 });
    expect(recordConflict).toHaveBeenCalledTimes(1);
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        localOperationType: 'delete',
        localOperationIds: ['first', 'second'],
        message: 'conflict | again',
      }),
    );
  });

  it('does not put an accepted create into a later update conflict for the same entity', async () => {
    const create = operation('board-create', 'create', {
      entityType: 'Board',
      entityId: 'board-1',
      payload: JSON.stringify({ name: 'Board', content: { nodes: [], edges: [] }, version: 1 }),
    });
    const update = operation('board-update', 'update', {
      entityType: 'Board',
      entityId: 'board-1',
      operationVersion: 2,
      payload: JSON.stringify({ content: { nodes: [], edges: [] }, version: 2 }),
    });
    await seedOperation(create);
    await seedOperation(update);

    await push.applyPushResult(
      {
        applied: [{ clientOperationId: 'board-create', operationVersion: 11 }],
        conflicts: [
          {
            clientOperationId: 'board-update',
            entity: 'Board',
            entityId: 'board-1',
            type: 'update',
            reason: 'validation',
            message: 'invalid update',
          },
        ],
      } as never,
      [create, update],
    );

    expect(await database.db.query.operationLogs.findFirst({ where: eq(schema.operationLogs.id, 'board-create') })).toMatchObject({
      isSynced: true,
      serverOperationVersion: 11,
    });
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ localOperationType: 'update', localOperationIds: ['board-update'] }),
    );
  });

  it('uses attempted changes when the refused operation is absent locally', async () => {
    await push.applyPushResult(
      {
        applied: [],
        conflicts: [
          {
            entity: 'Character',
            entityId: 'missing',
            type: 'create',
            reason: 'validation',
            message: 'invalid',
            attemptedChanges: { name: 'Attempted' },
          },
        ],
      } as never,
      [],
    );

    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ localValues: { name: 'Attempted' } }),
    );
  });

  it('silently merges disjoint stale fields and rebases the local edit', async () => {
    await database.db.insert(schema.characters).values({
      id: 'character-1',
      storyId: STORY_ID,
      name: 'Old server name',
      description: 'Old description',
      createdAt: NOW,
      updatedAt: NOW,
      version: 4,
      isDeleted: false,
    });
    const local = operation('disjoint', 'update', {
      payload: JSON.stringify({ description: 'Local description', version: 3 }),
    });
    await seedOperation(local);

    const result = await push.applyPushResult(
      {
        applied: [],
        conflicts: [
          {
            entity: 'Character',
            entityId: 'character-1',
            type: 'update',
            reason: 'version_conflict',
            message: 'stale',
            changedFields: ['name'],
            serverEntity: { name: 'New server name', description: 'Old description' },
            serverVersion: 7,
          },
        ],
      } as never,
      [local],
    );

    expect(result).toEqual({ applied: 0, conflicts: 0 });
    expect(recordConflict).not.toHaveBeenCalled();
    expect(await database.db.query.characters.findFirst()).toMatchObject({
      name: 'New server name',
      description: 'Old description',
    });
    expect(JSON.parse((await database.db.query.operationLogs.findFirst())!.payload).version).toBe(
      8,
    );
  });

  it('does not surface a conflict when both sides reached the same value', async () => {
    await database.db.insert(schema.characters).values({
      id: 'character-1',
      storyId: STORY_ID,
      name: 'Same name',
      createdAt: NOW,
      updatedAt: NOW,
      version: 4,
      isDeleted: false,
    });
    const local = operation('same-value', 'update', {
      payload: JSON.stringify({ name: 'Same name', version: 3 }),
    });
    await seedOperation(local);

    const result = await push.applyPushResult(
      {
        applied: [],
        conflicts: [
          {
            entity: 'Character',
            entityId: 'character-1',
            type: 'update',
            reason: 'version_conflict',
            message: 'stale',
            changedFields: ['name'],
            serverEntity: { name: 'Same name' },
            serverVersion: 5,
          },
        ],
      } as never,
      [local],
    );

    expect(result).toEqual({ applied: 0, conflicts: 0 });
    expect(recordConflict).not.toHaveBeenCalled();
  });

  it('notifies immediately when result handling is not silent', async () => {
    const accepted = operation('accepted-now', 'update');
    await seedOperation(accepted);

    await push.applyPushResult(
      {
        applied: [{ clientOperationId: accepted.id, operationVersion: 8 }],
        conflicts: [],
      } as unknown as SyncPushResult,
      [accepted],
    );

    expect(showNotification).toHaveBeenCalledWith(expect.any(String), 'success');
  });
});

describe('push loop', () => {
  it('leaves an unsafe operation pending without sending an empty batch', async () => {
    await seedOperation(
      operation('unsafe', 'update', { payload: JSON.stringify({ name: 'Missing base' }) }),
    );

    await expect(push.pushPendingOperations()).resolves.toEqual({ offline: false });

    expect(post).not.toHaveBeenCalled();
    expect(await database.db.query.operationLogs.findFirst()).toMatchObject({ isSynced: false });
  });

  it('stops when a valid response makes no queue progress', async () => {
    await seedOperation(operation('stuck', 'update'));
    post.mockResolvedValue({ data: { applied: [], conflicts: [] } });

    await expect(push.pushPendingOperations()).resolves.toEqual({ offline: false });

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('reports accumulated accepted operations and conflicts once', async () => {
    await seedOperation(operation('accepted', 'update'));
    post.mockResolvedValue({
      data: {
        applied: [{ clientOperationId: 'accepted', operationVersion: 3 }],
        conflicts: [],
      },
    });

    await push.pushPendingOperations();

    expect(showNotification).toHaveBeenCalledWith(expect.any(String), 'success');
  });
});
