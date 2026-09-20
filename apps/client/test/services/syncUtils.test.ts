/**
 * @jest-environment node
 */
import { asc, eq } from 'drizzle-orm';
import { operationLogs, stories } from '../../src/db/schema';
import { entityEventEmitter } from '../../src/utils/EventEmitter';
import {
  assertStoryIsOwned,
  assertStoryIsWritable,
  getUserIdForOperation,
  MAX_RETAINED_SYNCED_OPERATIONS,
  recordLocalOperation,
  StoryOwnerOnlyError,
  StoryReadOnlyError,
  trimSyncedOperationLogs,
} from '../../src/utils/syncUtils';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

const STORY_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

let database: TestDatabase;

async function seedStory(overrides: Partial<typeof stories.$inferInsert> = {}) {
  const now = new Date();
  await database.db.insert(stories).values({
    id: STORY_ID,
    userId: 'local-user',
    title: 'A Queda',
    type: 'linear',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    ...overrides,
  });
}

const readStory = () => database.db.query.stories.findFirst({ where: eq(stories.id, STORY_ID) });

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
 * The operation log is what the push sends; its numbering is what gives synchronization its order. A
 * repeated `operationVersion` or a `lastOperationLog` that does not advance corrupts what the server
 * receives, and it is invisible until the next synchronization.
 */
describe('recordLocalOperation', () => {
  it('records the operation with everything the push needs', async () => {
    await seedStory();

    await recordLocalOperation(database.db, STORY_ID, 'user-1', 'create', 'Character', 'char-1', {
      name: 'Keres',
    });

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log).toMatchObject({
      storyId: STORY_ID,
      userId: 'user-1',
      operationType: 'create',
      entityType: 'Character',
      entityId: 'char-1',
      isSynced: false,
      serverOperationVersion: 0,
    });
    expect(JSON.parse(log.payload)).toEqual({ name: 'Keres' });
  });

  it('numbers the first operation of a story as 1', async () => {
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

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log.operationVersion).toBe(1);
  });

  it('numbers each operation one past the story cursor', async () => {
    await seedStory({ lastOperationLog: 7 });

    await recordLocalOperation(
      database.db,
      STORY_ID,
      'user-1',
      'update',
      'Character',
      'char-1',
      {},
    );

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log.operationVersion).toBe(8);
  });

  it('advances the story cursor, so the next operation does not reuse the number', async () => {
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
    await recordLocalOperation(
      database.db,
      STORY_ID,
      'user-1',
      'update',
      'Character',
      'char-1',
      {},
    );

    const logs = await database.db.query.operationLogs.findMany();
    expect(logs.map((log) => log.operationVersion).sort()).toEqual([1, 2]);
    expect((await readStory())!.lastOperationLog).toBe(2);
  });

  it('gives every operation its own id', async () => {
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
    await recordLocalOperation(
      database.db,
      STORY_ID,
      'user-1',
      'create',
      'Character',
      'char-2',
      {},
    );

    const logs = await database.db.query.operationLogs.findMany();
    expect(new Set(logs.map((log) => log.id)).size).toBe(2);
  });

  it('touches the story updatedAt, so the list screens reorder', async () => {
    await seedStory({ updatedAt: new Date(0) });

    await recordLocalOperation(
      database.db,
      STORY_ID,
      'user-1',
      'create',
      'Character',
      'char-1',
      {},
    );

    expect((await readStory())!.updatedAt.getTime()).toBeGreaterThan(0);
  });

  it('announces the change, so an open operation log screen refreshes', async () => {
    await seedStory();
    const listener = jest.fn();
    entityEventEmitter.on('operation_log_updated', listener);

    await recordLocalOperation(
      database.db,
      STORY_ID,
      'user-1',
      'create',
      'Character',
      'char-1',
      {},
    );
    entityEventEmitter.off('operation_log_updated', listener);

    expect(listener).toHaveBeenCalledWith(STORY_ID);
  });

  it('stores the payload as JSON that survives a round trip', async () => {
    await seedStory();
    const payload = { name: 'Keres', tags: ['a', 'b'], nested: { deep: true }, missing: null };

    await recordLocalOperation(
      database.db,
      STORY_ID,
      'user-1',
      'update',
      'Character',
      'char-1',
      payload,
    );

    const [log] = await database.db.query.operationLogs.findMany();
    expect(JSON.parse(log.payload)).toEqual(payload);
  });

  it('does nothing but complain when there is no database', async () => {
    await expect(
      recordLocalOperation(null as never, STORY_ID, 'user-1', 'create', 'Character', 'char-1', {}),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('starts numbering at 1 for a story it cannot find, rather than failing', async () => {
    await recordLocalOperation(
      database.db,
      'nao-existe',
      'user-1',
      'create',
      'Character',
      'char-1',
      {},
    );

    const [log] = await database.db.query.operationLogs.findMany();
    expect(log.operationVersion).toBe(1);
  });
});

/**
 * This guard exists because the local write is optimistic: without it, a reader's edit enters the
 * database right away, is refused by the server on every synchronization cycle from then on, and never
 * goes away.
 */
describe('assertStoryIsWritable', () => {
  it('allows a story that was never linked to a server', async () => {
    await seedStory({ serverId: null, myRole: null });

    await expect(assertStoryIsWritable(database.db, STORY_ID)).resolves.toBeUndefined();
  });

  it.each(['owner', 'writer'] as const)(
    'allows a linked story where the user is %s',
    async (myRole) => {
      await seedStory({ serverId: 'server-1', myRole });

      await expect(assertStoryIsWritable(database.db, STORY_ID)).resolves.toBeUndefined();
    },
  );

  it('refuses a linked story where the user is only a reader', async () => {
    await seedStory({ serverId: 'server-1', myRole: 'reader' });

    await expect(assertStoryIsWritable(database.db, STORY_ID)).rejects.toBeInstanceOf(
      StoryReadOnlyError,
    );
  });

  it('fails closed while the role has not resolved yet', async () => {
    await seedStory({ serverId: 'server-1', myRole: null });

    await expect(assertStoryIsWritable(database.db, STORY_ID)).rejects.toBeInstanceOf(
      StoryReadOnlyError,
    );
  });

  it('allows a story it cannot find, since there is nothing to protect', async () => {
    await expect(assertStoryIsWritable(database.db, 'nao-existe')).resolves.toBeUndefined();
  });
});

/**
 * A story's policy and identity belong to its owner on the server alone. Without this guard, a writer
 * would write type/favoriteBehavior/allowReaderComments (or delete the story) locally and the push
 * would come back `unauthorized` on every cycle.
 */
describe('assertStoryIsOwned', () => {
  it('allows a story that was never linked to a server', async () => {
    await seedStory({ serverId: null, myRole: null });

    await expect(assertStoryIsOwned(database.db, STORY_ID)).resolves.toBeUndefined();
  });

  it('allows a linked story where the user is the owner', async () => {
    await seedStory({ serverId: 'server-1', myRole: 'owner' });

    await expect(assertStoryIsOwned(database.db, STORY_ID)).resolves.toBeUndefined();
  });

  it.each(['writer', 'reader'] as const)(
    'refuses a linked story where the user is only a %s',
    async (myRole) => {
      await seedStory({ serverId: 'server-1', myRole });

      await expect(assertStoryIsOwned(database.db, STORY_ID)).rejects.toBeInstanceOf(
        StoryOwnerOnlyError,
      );
    },
  );

  it('fails closed while the role has not resolved yet', async () => {
    await seedStory({ serverId: 'server-1', myRole: null });

    await expect(assertStoryIsOwned(database.db, STORY_ID)).rejects.toBeInstanceOf(
      StoryOwnerOnlyError,
    );
  });

  it('allows a story it cannot find, since there is nothing to protect', async () => {
    await expect(assertStoryIsOwned(database.db, 'nao-existe')).resolves.toBeUndefined();
  });
});

/**
 * Retention is what stops the on-device log from growing forever - one row per save, soon with
 * scene prose inside the payloads. The trim must only ever eat synchronized, conflict-free
 * history: pending operations are the queue, and conflicted ones are the conflict screen's
 * evidence.
 */
describe('trimSyncedOperationLogs', () => {
  let sequence = 0;

  async function seedLog(overrides: Partial<typeof operationLogs.$inferInsert> = {}) {
    sequence += 1;
    await database.db.insert(operationLogs).values({
      id: `log-${sequence}`,
      storyId: STORY_ID,
      userId: 'local-user',
      operationVersion: sequence,
      operationType: 'update',
      entityType: 'Scene',
      entityId: 'scene-1',
      payload: JSON.stringify({ version: sequence }),
      // Same instant on purpose: the trim must order by operationVersion, never createdAt.
      createdAt: new Date(1_700_000_000_000),
      isSynced: true,
      serverOperationVersion: sequence,
      ...overrides,
    });
  }

  const remainingVersions = async () =>
    (
      await database.db.query.operationLogs.findMany({
        where: eq(operationLogs.storyId, STORY_ID),
        columns: { operationVersion: true },
        orderBy: [asc(operationLogs.operationVersion)],
      })
    ).map((row) => row.operationVersion);

  beforeEach(() => {
    sequence = 0;
  });

  it('keeps the newest synced operations and drops the rest', async () => {
    for (let version = 1; version <= 5; version += 1) {
      await seedLog({ operationVersion: version });
    }

    const removed = await trimSyncedOperationLogs(database.db, STORY_ID, 3);

    expect(removed).toBe(2);
    expect(await remainingVersions()).toEqual([3, 4, 5]);
  });

  it('keeps every operation that is still waiting for the server', async () => {
    await seedLog({ operationVersion: 1, isSynced: false });
    await seedLog({ operationVersion: 2, isSynced: true });
    await seedLog({ operationVersion: 3, isSynced: true });

    const removed = await trimSyncedOperationLogs(database.db, STORY_ID, 1);

    expect(removed).toBe(1);
    expect(await remainingVersions()).toEqual([1, 3]);
  });

  it.each(['conflicted', 'abandoned'] as const)(
    'never trims a %s operation, whatever its age',
    async (conflictState) => {
      await seedLog({ operationVersion: 1, conflictState });
      await seedLog({ operationVersion: 2 });
      await seedLog({ operationVersion: 3 });

      const removed = await trimSyncedOperationLogs(database.db, STORY_ID, 1);

      expect(removed).toBe(1);
      expect(await remainingVersions()).toEqual([1, 3]);
    },
  );

  it('does nothing when the synchronized history fits the budget', async () => {
    await seedLog({ operationVersion: 1 });
    await seedLog({ operationVersion: 2 });

    const removed = await trimSyncedOperationLogs(database.db, STORY_ID, 2);

    expect(removed).toBe(0);
    expect(await remainingVersions()).toEqual([1, 2]);
  });

  it('leaves other stories alone', async () => {
    await seedLog({ operationVersion: 1 });
    await seedLog({ operationVersion: 2, storyId: 'outra-historia' });

    const removed = await trimSyncedOperationLogs(database.db, STORY_ID, 0);

    expect(removed).toBe(1);
    const other = await database.db.query.operationLogs.findMany({
      where: eq(operationLogs.storyId, 'outra-historia'),
    });
    expect(other).toHaveLength(1);
  });

  it('retains 100 synchronized operations by default', async () => {
    expect(MAX_RETAINED_SYNCED_OPERATIONS).toBe(100);
    for (let version = 1; version <= 102; version += 1) {
      await seedLog({ operationVersion: version });
    }

    const removed = await trimSyncedOperationLogs(database.db, STORY_ID);

    expect(removed).toBe(2);
    expect(await remainingVersions()).toHaveLength(100);
  });

  it('does nothing but complain when there is no database', async () => {
    await expect(trimSyncedOperationLogs(null as never, STORY_ID)).resolves.toBe(0);
    expect(console.error).toHaveBeenCalled();
  });
});

describe('getUserIdForOperation', () => {
  const serverService = (idUser: string | null) =>
    ({
      getServerById: jest.fn(async () =>
        idUser === null ? undefined : { id: 'server-1', idUser },
      ),
    }) as never;

  it('uses the server account id for a synced story', async () => {
    await seedStory({ serverId: 'server-1' });

    const userId = await getUserIdForOperation(
      database.db,
      serverService('server-user'),
      STORY_ID,
      'local-user',
    );

    expect(userId).toBe('server-user');
  });

  it('falls back to the local id for a story that was never synced', async () => {
    await seedStory({ serverId: null });

    const userId = await getUserIdForOperation(
      database.db,
      serverService('server-user'),
      STORY_ID,
      'local-user',
    );

    expect(userId).toBe('local-user');
  });

  it('falls back to the local id when the server is not signed in', async () => {
    await seedStory({ serverId: 'server-1' });

    const userId = await getUserIdForOperation(
      database.db,
      serverService(null),
      STORY_ID,
      'local-user',
    );

    expect(userId).toBe('local-user');
  });

  it('falls back to the local id for a story it cannot find', async () => {
    const userId = await getUserIdForOperation(
      database.db,
      serverService('server-user'),
      'nao-existe',
      'local-user',
    );

    expect(userId).toBe('local-user');
  });
});
