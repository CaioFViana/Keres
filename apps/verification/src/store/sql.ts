import { Database } from 'bun:sqlite';

/**
 * The small SQL surface the stores use, written so it reads the same on `bun:sqlite` (production) and on Node's
 * `node:sqlite` (the vitest shim in `test/shims`): positional parameters only, `prepare`, `exec`, and nothing that is
 * one runtime's extension. A missing row is `null` from Bun and `undefined` from Node, so both are read as absent.
 */

export type SqlValue = string | number | null | Uint8Array;

export type { Database };

/** Opens a database file with the pragmas the caller needs, before any table is touched. */
export function openDatabase(file: string, pragmas: readonly string[], schema: string): Database {
  const db = new Database(file);
  for (const pragma of pragmas) db.exec(pragma);
  db.exec(schema);
  return db;
}

export function run(db: Database, sql: string, ...params: SqlValue[]): void {
  db.prepare(sql).run(...params);
}

export function one<T>(db: Database, sql: string, ...params: SqlValue[]): T | undefined {
  const row = db.prepare(sql).get(...params) as T | null | undefined;
  return row ?? undefined;
}

export function all<T>(db: Database, sql: string, ...params: SqlValue[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

/**
 * Runs `work` in one immediate transaction: the status change, its audit line and the outbox row land together or not
 * at all. `work` must not await - the stores are synchronous on purpose, so no other request can interleave.
 */
export function transaction<T>(db: Database, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
