/**
 * @jest-environment node
 */
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import migrations from '../../src/db/migrations';

function expoLikeDatabase(raw: Database.Database) {
  return {
    execAsync: async (sql: string) => raw.exec(sql),
    getAllAsync: async <T>(sql: string) => raw.prepare(sql).all() as T[],
    runAsync: async (sql: string, ...params: unknown[]) => raw.prepare(sql).run(...params),
  };
}

let raw: Database.Database;

beforeEach(() => {
  raw = new Database(':memory:');
});

afterEach(() => raw.close());

it('applies every production migration once and remains idempotent on later boots', async () => {
  const expoDb = expoLikeDatabase(raw);
  jest.spyOn(console, 'log').mockImplementation(() => {});

  await migrate(expoDb as never);
  await migrate(expoDb as never);

  const applied = raw
    .prepare<[], { name: string }>('SELECT name FROM _migrations ORDER BY id')
    .all();
  const storySchemaColumns = raw
    .prepare<[], { name: string }>('PRAGMA table_info(story_schema_fields)')
    .all()
    .map((column) => column.name);

  expect(applied.map(({ name }) => name)).toEqual(migrations.map(({ name }) => name));
  expect(new Set(applied.map(({ name }) => name)).size).toBe(migrations.length);
  expect(storySchemaColumns).toContain('target_entity_type');
});
