/**
 * @jest-environment node
 */
jest.mock('../../src/utils/syncUtils', () => {
  const actual = jest.requireActual('../../src/utils/syncUtils');
  return {
    ...actual,
    trimSyncedOperationLogs: jest.fn((...args: unknown[]) =>
      (actual.trimSyncedOperationLogs as (...inner: unknown[]) => unknown)(...args),
    ),
  };
});

import * as schema from '../../src/db/schema';
import type { OperationLogSelect } from '../../src/db/schema';
import { SyncPush } from '../../src/services/sync/SyncPush';
import type { SyncNotifier } from '../../src/services/sync/SyncNotifier';
import { trimSyncedOperationLogs } from '../../src/utils/syncUtils';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');

let database: TestDatabase;
let post: jest.Mock;
let push: SyncPush;
let notifier: jest.Mocked<SyncNotifier>;

const trimMock = trimSyncedOperationLogs as jest.Mock;

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
    conflictService: () => ({ recordConflict: jest.fn() }) as never,
    notifier: () => notifier,
    abortSignal: () => new AbortController().signal,
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  trimMock.mockClear();
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('push retention best-effort', () => {
  async function seedSyncedOp() {
    await database.db.insert(schema.operationLogs).values({
      id: 'op-1',
      storyId: STORY_ID,
      userId: 'local-user',
      operationVersion: 1,
      operationType: 'update',
      entityType: 'Character',
      entityId: 'character-1',
      payload: JSON.stringify({ name: 'Local', version: 2 }),
      createdAt: NOW,
      isSynced: false,
      serverOperationVersion: 0,
      conflictState: null,
    } as OperationLogSelect);
    post.mockResolvedValue({
      data: { applied: [{ clientOperationId: 'op-1', operationVersion: 7 }], conflicts: [] },
    });
  }

  it('still reports success when trimming synced history throws an Error', async () => {
    await seedSyncedOp();
    trimMock.mockRejectedValueOnce(new Error('trim boom'));

    await expect(push.pushPendingOperations()).resolves.toEqual({ offline: false });

    expect(trimMock).toHaveBeenCalledTimes(1);
    expect(notifier.pushedUpdates).toHaveBeenCalledWith(1);
  });

  it('still reports success when trimming fails without an Error message', async () => {
    await seedSyncedOp();
    trimMock.mockRejectedValueOnce('trim string boom');

    await expect(push.pushPendingOperations()).resolves.toEqual({ offline: false });

    expect(trimMock).toHaveBeenCalledTimes(1);
    expect(notifier.pushedUpdates).toHaveBeenCalledWith(1);
  });
});
