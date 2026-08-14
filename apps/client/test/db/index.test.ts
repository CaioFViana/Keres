/**
 * @jest-environment node
 */
import Database from 'better-sqlite3';
import { initializeDrizzle, resetDatabase } from '../../src/db';

function expoLikeDatabase(raw: Database.Database) {
  return {
    execAsync: async (sql: string) => raw.exec(sql),
    getAllAsync: async <T>(sql: string) => raw.prepare(sql).all() as T[],
  };
}

let raw: Database.Database;

beforeEach(() => {
  raw = new Database(':memory:');
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  raw.close();
  jest.restoreAllMocks();
});

it('keeps one initialized Drizzle client until resetDatabase drops the local tables', async () => {
  const expoDb = expoLikeDatabase(raw);
  raw.exec('CREATE TABLE disposable (id TEXT PRIMARY KEY);');

  const first = initializeDrizzle(expoDb as never);
  const sameInstance = initializeDrizzle(expoDb as never);
  await resetDatabase(expoDb as never);
  const afterReset = initializeDrizzle(expoDb as never);
  const remainingTables = raw
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all();

  expect(sameInstance).toBe(first);
  expect(afterReset).not.toBe(first);
  expect(remainingTables).toEqual([]);
});
