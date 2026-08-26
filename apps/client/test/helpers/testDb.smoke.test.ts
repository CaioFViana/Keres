/**
 * @jest-environment node
 */
import { stories } from '../../src/db/schema';
import { createTestDatabase, listTables, type TestDatabase } from './testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(() => {
  database.close();
});

/**
 * The helper is the foundation of the whole of Phase 4: if the production migrations stop applying on
 * the test driver, this is where that has to show up, not scattered across every suite.
 */
describe('createTestDatabase', () => {
  it('applies the production migrations', () => {
    const tables = listTables(database.raw);

    expect(tables).toContain('stories');
    expect(tables).toContain('characters');
    expect(tables).toContain('operation_logs');
    expect(tables.length).toBeGreaterThan(20);
  });

  it('accepts a write through drizzle using the production schema', async () => {
    const { db } = database;
    const now = new Date();

    await db.insert(stories).values({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      userId: 'local-user',
      title: 'A Queda',
      type: 'linear',
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
    });

    const rows = await db.query.stories.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('A Queda');
  });

  it('starts empty for every test, so suites cannot leak into each other', async () => {
    const rows = await database.db.query.stories.findMany();

    expect(rows).toEqual([]);
  });
});

/**
 * `db.transaction(async (tx) => {...})` runs in production (expo-sqlite is genuinely async), but
 * better-sqlite3's native wrapper rejects any callback that returns a Promise - and calling an `async`
 * function always returns one. Without the patch in `createTestDatabase`, the two tests below would
 * throw `TypeError: Transaction function cannot return a promise`.
 */
describe('async transactions against the test driver', () => {
  const row = (id: string) => ({
    id,
    userId: 'local-user',
    title: id,
    type: 'linear' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    isDeleted: false,
  });

  it('commits every write made through the async callback', async () => {
    const { db } = database;

    await db.transaction(async (tx) => {
      await tx.insert(stories).values(row('story-1'));
      await tx.insert(stories).values(row('story-2'));
    });

    const rows = await db.query.stories.findMany();
    expect(rows.map((r) => r.id).sort()).toEqual(['story-1', 'story-2']);
  });

  it('rolls back every write made through the async callback when it throws', async () => {
    const { db } = database;

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(stories).values(row('story-1'));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const rows = await db.query.stories.findMany();
    expect(rows).toEqual([]);
  });
});
