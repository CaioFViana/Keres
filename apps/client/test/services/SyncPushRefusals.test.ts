/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import type { OperationLogSelect } from '../../src/db/schema';
import type { SyncNotifier } from '../../src/services/sync/SyncNotifier';
import { SyncPush } from '../../src/services/sync/SyncPush';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const CHAPTER_ID = 'CHAPTER1ZZZZZZZZZZZZZZZZZZ';
const NOW = new Date('2026-08-10T12:00:00.000Z');

let database: TestDatabase;
let post: jest.Mock;
let recordConflict: jest.Mock;
let push: SyncPush;

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
    entityType: 'Chapter',
    entityId: CHAPTER_ID,
    payload: JSON.stringify({ rank: 'a5', version: 2 }),
    createdAt: NOW,
    isSynced: false,
    serverOperationVersion: null,
    conflictState: null,
    ...overrides,
  }) as OperationLogSelect;

const seedChapter = () =>
  database.db.insert(schema.chapters).values({
    id: CHAPTER_ID,
    storyId: STORY_ID,
    name: 'Chapter',
    index: 1,
    rank: 'a1',
    type: 'chapter',
    createdAt: NOW,
    updatedAt: NOW,
    version: 2,
    isDeleted: false,
  } as never);

const chapterRow = () =>
  database.db.select().from(schema.chapters).where(eq(schema.chapters.id, CHAPTER_ID)).get();

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
  const notifier = {
    remoteUpdatesReceived: jest.fn(),
    remoteUpdatesFailed: jest.fn(),
    conflictsDetected: jest.fn(),
    pushedUpdates: jest.fn(),
    pushFailed: jest.fn(),
    syncFailed: jest.fn(),
    protocolMismatch: jest.fn(),
    storyNotFound: jest.fn(),
    message: jest.fn(),
  } as jest.Mocked<SyncNotifier>;
  push = new SyncPush({
    db: () => database.db,
    storyId: () => STORY_ID,
    client: () => ({ post }) as never,
    conflictService: () => ({ recordConflict }) as never,
    notifier: () => notifier,
    abortSignal: () => new AbortController().signal,
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('a move of a row the server deleted', () => {
  const refusal = (overrides: Record<string, unknown> = {}) => ({
    clientOperationId: 'move',
    entity: 'Chapter',
    entityId: CHAPTER_ID,
    type: 'update',
    reason: 'deleted_on_server',
    message: 'deleted',
    ...overrides,
  });

  it('accepts the deletion with the server tombstone and asks nothing', async () => {
    await seedChapter();
    const move = operation('move', 'update');
    await database.db.insert(schema.operationLogs).values(move);

    const result = await push.applyPushResult(
      {
        applied: [],
        conflicts: [refusal({ serverEntity: { name: 'Server tomb' }, serverVersion: 7 })],
      } as never,
      [move],
    );

    expect(result).toEqual({ applied: 0, conflicts: 0 });
    expect(recordConflict).not.toHaveBeenCalled();
    expect(await readOperation('move')).toMatchObject({
      isSynced: true,
      conflictState: 'abandoned',
    });
    expect(await chapterRow()).toMatchObject({ isDeleted: true, version: 7, name: 'Server tomb' });
  });

  it('keeps the local version when the refusal names none and carries no tombstone', async () => {
    await seedChapter();
    const move = operation('move', 'update');
    await database.db.insert(schema.operationLogs).values(move);

    await push.applyPushResult({ applied: [], conflicts: [refusal()] } as never, [move]);

    expect(recordConflict).not.toHaveBeenCalled();
    expect(await chapterRow()).toMatchObject({ isDeleted: true, version: 2, name: 'Chapter' });
  });

  it('still asks when the local edit is more than a move', async () => {
    await seedChapter();
    const edit = operation('move', 'update', {
      payload: JSON.stringify({ name: 'Renamed', version: 2 }),
    });
    await database.db.insert(schema.operationLogs).values(edit);

    await push.applyPushResult({ applied: [], conflicts: [refusal()] } as never, [edit]);

    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'deleted_on_server' }),
    );
  });
});

describe('an operation the server would refuse as malformed', () => {
  it('quarantines an envelope that fails the shared schema instead of sending the batch', async () => {
    await database.db.insert(schema.operationLogs).values(
      operation('odd', 'update', {
        entityType: 'NotAnEntity',
        entityId: 'odd-1',
        payload: JSON.stringify({ name: 'x', version: 2 }),
      }),
    );

    await expect(push.pushPendingOperations()).resolves.toEqual({ offline: false });

    expect(post).not.toHaveBeenCalled();
    expect(recordConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'validation',
        localOperationIds: ['odd'],
        message: expect.stringContaining('not a valid sync operation'),
      }),
    );
  });
});
