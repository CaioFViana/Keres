import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { AppDrizzleClient } from '../../src/db';
import migrations from '../../src/db/migrations';
import * as schema from '../../src/db/schema';

/**
 * An in-memory test database for the services that talk to SQLite.
 *
 * `expo-sqlite` does not run in Node, but the tables are declared with `drizzle-orm/sqlite-core` - the
 * same definitions work for the `better-sqlite3` driver, so the services run against the real schema
 * rather than a database mock.
 *
 * The migrations are the production ones too, with no copy: each file in `src/db/migrations` is a
 * function receiving something with `execAsync(sql)`, so it is enough to hand it an object with that
 * method backed by better-sqlite3's `exec`. If a new migration breaks the schema, this suite breaks
 * with it, which is exactly what we want.
 */
export interface TestDatabase {
  /**
   * Typed as the production client (`AppDrizzleClient`, over expo-sqlite) so the services can be called
   * without a cast in every test.
   *
   * The conversion is safe and stays contained at this point: both instances are the same drizzle
   * `SQLiteDatabase` over the same schema, and they differ only in the type of the `RunResult` each driver
   * returns (expo-sqlite's `lastInsertRowId`/`changes` against better-sqlite3's) - a value no service in
   * this app reads.
   */
  db: AppDrizzleClient;
  raw: Database.Database;
  close: () => void;
}

/**
 * better-sqlite3 is synchronous by nature: its native `.transaction(fn)` checks, when `fn` returns,
 * whether the result has a `.then` and throws `TypeError: Transaction function cannot return a promise`
 * if it does - and calling an `async` function always returns a Promise, whatever is inside it. That
 * breaks every `db.transaction(async (tx) => {...})` in the app (which runs fine in production, over
 * `expo-sqlite`, which is genuinely async).
 *
 * Detecting "it is an async function" before calling is not reliable: Jest's Babel transpiles
 * `async (tx) => {...}` into an ordinary generator-backed function (`asyncToGenerator`), so
 * `fn.constructor.name`/`Object.prototype.toString.call(fn)` do not report `AsyncFunction` under test,
 * only in production. Detecting it wrongly is worse than not detecting it: falling into the native
 * wrapper by mistake makes it throw the `TypeError` immediately, without ever awaiting the result - and
 * since nobody else holds that Promise, the callback's continuation (the code after the first `await`)
 * runs later, with no transaction underneath, as an unhandled rejection.
 *
 * That is why the instance is overridden (not the prototype - it stays isolated to this test database)
 * to ALWAYS run its own implementation, deciding only after calling `fn`: if the return value is
 * "thenable", it genuinely awaits it before deciding commit/rollback; if it is not, it decides right
 * away, just as the native wrapper would with a synchronous callback.
 */
function patchAsyncTransactions(raw: Database.Database): void {
  const isThenable = (value: unknown): value is PromiseLike<unknown> =>
    !!value && typeof (value as { then?: unknown }).then === 'function';

  const run = (fn: (...args: never[]) => unknown, begin: string, args: never[]) => {
    const nested = raw.inTransaction;
    raw.exec(nested ? 'SAVEPOINT async_tx' : begin);

    const commit = <T>(value: T) => {
      raw.exec(nested ? 'RELEASE async_tx' : 'COMMIT');
      return value;
    };
    const rollback = (error: unknown): never => {
      raw.exec(nested ? 'ROLLBACK TO async_tx' : 'ROLLBACK');
      if (nested) raw.exec('RELEASE async_tx');
      throw error;
    };

    let result: unknown;
    try {
      result = fn(...args);
    } catch (error) {
      rollback(error);
    }

    return isThenable(result) ? Promise.resolve(result).then(commit, rollback) : commit(result);
  };

  raw.transaction = ((fn: (...args: never[]) => unknown) => {
    const wrapper = (...args: never[]) => run(fn, 'BEGIN', args);
    wrapper.deferred = (...args: never[]) => run(fn, 'BEGIN DEFERRED', args);
    wrapper.immediate = (...args: never[]) => run(fn, 'BEGIN IMMEDIATE', args);
    wrapper.exclusive = (...args: never[]) => run(fn, 'BEGIN EXCLUSIVE', args);
    wrapper.default = wrapper;
    wrapper.database = raw;
    return wrapper;
  }) as unknown as Database.Database['transaction'];
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  patchAsyncTransactions(raw);

  const expoLikeDatabase = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
  };

  for (const migration of migrations) {
    await migration.run(expoLikeDatabase as never);
  }

  return {
    db: drizzle(raw, { schema }) as unknown as AppDrizzleClient,
    raw,
    close: () => raw.close(),
  };
}

/** The tables present in the database, to check the migrations really did run. */
export function listTables(raw: Database.Database): string[] {
  return raw
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all()
    .map((row) => row.name)
    .sort();
}
