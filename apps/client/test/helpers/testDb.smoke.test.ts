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
 * O helper é a base de toda a Fase 4: se as migrações de produção pararem de aplicar sobre o
 * driver de teste, é aqui que isso precisa aparecer, e não espalhado por cada suíte.
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
