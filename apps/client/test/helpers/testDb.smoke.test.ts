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

/**
 * `db.transaction(async (tx) => {...})` roda em produção (expo-sqlite é async de verdade),
 * mas o wrapper nativo do better-sqlite3 rejeita qualquer callback que devolva uma Promise -
 * e chamar uma função `async` sempre devolve uma. Sem o patch em `createTestDatabase`, os dois
 * testes abaixo lançariam `TypeError: Transaction function cannot return a promise`.
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
