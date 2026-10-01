/**
 * @jest-environment node
 */
import { asc, eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createSyncConflictService } from '../../src/services/SyncConflictService';
import { withOpLogLock } from '../../src/utils/opLogMutex';
import { recordLocalOperation } from '../../src/utils/syncUtils';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const NOW = new Date('2026-08-10T12:00:00.000Z');

let database: TestDatabase;

async function seedStory() {
  await database.db.insert(schema.stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'A Queda',
    type: 'linear',
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    isDeleted: false,
  });
}

const readVersions = async () =>
  (
    await database.db.query.operationLogs.findMany({
      where: eq(schema.operationLogs.storyId, STORY_ID),
      columns: { operationVersion: true },
      orderBy: [asc(schema.operationLogs.operationVersion)],
    })
  ).map((row) => row.operationVersion);

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

/**
 * Version assignment is read-counter → insert → bump-story over three awaits; without the
 * per-story lock, concurrent writers read the same counter and insert the same version.
 */
describe('concurrent recordLocalOperation', () => {
  it('numbers parallel writes on one story as a dense 1..N sequence', async () => {
    await seedStory();
    const count = 15;

    await Promise.all(
      Array.from({ length: count }, (_, index) =>
        recordLocalOperation(
          database.db,
          STORY_ID,
          'user-1',
          'update',
          'Character',
          `char-${index}`,
          {
            version: 2,
          },
        ),
      ),
    );

    expect(await readVersions()).toEqual(Array.from({ length: count }, (_, index) => index + 1));
    const story = await database.db.query.stories.findFirst({
      where: eq(schema.stories.id, STORY_ID),
    });
    expect(story!.lastOperationLog).toBe(count);
  });

  it('serializes a conflict rebase against a concurrent local write', async () => {
    await seedStory();
    await database.db.insert(schema.characters).values({
      id: 'char-1',
      storyId: STORY_ID,
      name: 'Original',
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
      isDeleted: false,
    });
    const service = createSyncConflictService(database.db);
    await service.recordConflict({
      storyId: STORY_ID,
      entityType: 'Character',
      entityId: 'char-1',
      reason: 'version_conflict',
      localOperationType: 'update',
      localOperationIds: [],
      localValues: { name: 'Meu nome' },
      serverValues: { name: 'Nome do servidor' },
      serverVersion: 3,
    });
    const [pending] = await service.getPendingConflicts();

    // The rebase and the local write both sequence against lastOperationLog: they must
    // take versions 1 and 2 in some order, never twice the same one.
    await Promise.all([
      service.resolveKeepLocal(pending.id),
      recordLocalOperation(database.db, STORY_ID, 'user-1', 'update', 'Character', 'char-1', {
        version: 2,
      }),
    ]);

    expect(await readVersions()).toEqual([1, 2]);
  });
});

describe('operation_logs uniqueness', () => {
  it('rejects a duplicate (storyId, operationVersion)', async () => {
    await seedStory();
    await recordLocalOperation(
      database.db,
      STORY_ID,
      'user-1',
      'create',
      'Character',
      'char-1',
      {},
    );

    await expect(
      database.db.insert(schema.operationLogs).values({
        id: 'duplicate-row',
        storyId: STORY_ID,
        userId: 'user-1',
        operationVersion: 1,
        operationType: 'create',
        entityType: 'Character',
        entityId: 'char-2',
        payload: JSON.stringify({}),
        createdAt: NOW,
        isSynced: false,
      }),
    ).rejects.toThrow(/unique/i);
  });

  it('creates the unique and query indexes', async () => {
    for (const name of [
      'operation_log_story_version_unique',
      'operation_log_pushable_idx',
      'operation_log_server_version_idx',
      'operation_log_entity_idx',
    ]) {
      const row = database.raw
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = '${name}'`)
        .get();
      expect(row).toBeTruthy();
    }
  });
});

describe('withOpLogLock', () => {
  it('runs same-story sections one at a time, in call order', async () => {
    const order: number[] = [];
    await Promise.all(
      [1, 2, 3].map((n) =>
        withOpLogLock('story-a', async () => {
          order.push(n);
          await new Promise((resolve) => setTimeout(resolve, 5));
          order.push(-n);
        }),
      ),
    );

    expect(order).toEqual([1, -1, 2, -2, 3, -3]);
  });

  it('lets different stories proceed without waiting for each other', async () => {
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const order: string[] = [];
    const blocked = withOpLogLock('story-a', async () => {
      order.push('a-start');
      await gate;
      order.push('a-end');
    });
    await withOpLogLock('story-b', async () => {
      order.push('b');
    });

    // Story B finished while story A still holds its lock.
    expect(order).toEqual(['a-start', 'b']);
    releaseGate();
    await blocked;
    expect(order).toEqual(['a-start', 'b', 'a-end']);
  });

  it('reports the error but does not stall the story behind it', async () => {
    await expect(
      withOpLogLock('story-a', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(withOpLogLock('story-a', async () => 42)).resolves.toBe(42);
  });
});
