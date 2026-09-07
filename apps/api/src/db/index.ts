import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { drizzle as drizzleLibsql, type LibSQLDatabase } from 'drizzle-orm/libsql';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import type { PgTransactionConfig } from 'drizzle-orm/pg-core';
import type { SQLiteTransactionConfig } from 'drizzle-orm/sqlite-core';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { usingSqlite } from './dialect';
import * as schema from './schema';

dotenv.config({ path: '../.env' });

/**
 * The database connection, on one of two engines.
 *
 * `DATABASE_DRIVER=postgres` (the default) uses a Postgres server, as always. `sqlite` uses a local
 * file through libSQL, for whoever wants to bring the API up without maintaining a separate database.
 *
 * libSQL, and not `bun:sqlite`/`better-sqlite3`: drizzle's synchronous SQLite drivers refuse an
 * `async` callback in `.transaction()`, and every transaction in this API is asynchronous - including
 * `withTransaction` below, which is the backbone of synchronization. libSQL speaks SQLite through an
 * async API, so none of that had to change.
 *
 * The exported contract contains only operations exercised against both drivers. Driver-specific
 * capabilities stay behind this module.
 */
/**
 * Operations guaranteed by Keres' PostgreSQL and libSQL adapters.
 *
 * The application deliberately uses this common Drizzle surface only. Add a new database operation
 * only together with a contract test that runs against both engines; engine-specific calls belong in
 * a dialect adapter, never in a service.
 */
type PostgresDb = NodePgDatabase<typeof schema>;
type SqliteDb = LibSQLDatabase<typeof schema>;
type CommonDatabaseOperations = Pick<
  PostgresDb,
  'query' | 'select' | 'selectDistinct' | 'insert' | 'update' | 'delete' | 'execute'
>;
type CompatibleTransactionConfig = PgTransactionConfig | SQLiteTransactionConfig;

export interface CompatibleDb extends CommonDatabaseOperations {
  transaction<T>(
    work: (tx: CompatibleDb) => Promise<T>,
    config?: CompatibleTransactionConfig,
  ): Promise<T>;
}

/**
 * The schemas use equivalent runtime modes for every shared column (Date, boolean, JSON and number).
 * Drizzle models the two drivers with unrelated generic types, so this is the one deliberate bridge
 * from libSQL to the application's compatible surface.
 */
function exposeCompatibleDb(database: PostgresDb | SqliteDb): CompatibleDb {
  return database as unknown as CompatibleDb;
}

function createPostgresDb(): PostgresDb {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Explicit instead of relying on `pg`'s defaults, since this pool is shared by the whole
    // API process. `max` bounds how many connections one instance can hold open against
    // Postgres at once; the two timeouts turn "Postgres is unreachable" into a clear error
    // within seconds instead of a request hanging until the client itself times out.
    max: 20,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

  // node-postgres emits 'error' on the pool when an idle client's connection dies
  // (DB restart, network blip). Without a listener, that's an unhandled EventEmitter
  // 'error' - Node throws it as an uncaught exception and kills the whole process.
  pool.on('error', (error) => {
    logger.error('Postgres pool error on an idle client', error);
  });

  return drizzlePostgres(pool, { schema, logger: false });
}

/**
 * `undefined` in a parameter becomes `NULL`.
 *
 * `pg` does that conversion by itself, and the API's code relies on it in every optional column
 * (`tierId: defaultTierId`, with `defaultTierId` possibly absent). libSQL, stricter, rejects
 * `undefined` and the whole insert fails. Normalising here, at the driver's edge, makes both engines
 * behave the same without touching any of the call sites.
 */
function toNullable(args: unknown): unknown {
  if (Array.isArray(args)) {
    return args.map((value) => (value === undefined ? null : value));
  }
  if (args && typeof args === 'object') {
    return Object.fromEntries(
      Object.entries(args as Record<string, unknown>).map(([key, value]) => [
        key,
        value === undefined ? null : value,
      ]),
    );
  }
  return args;
}

function sanitiseStatement(statement: unknown): unknown {
  if (statement && typeof statement === 'object' && 'args' in statement) {
    const typed = statement as { args?: unknown };
    return { ...typed, args: toNullable(typed.args) };
  }
  return statement;
}

/** Wraps a client's (or a transaction's) `execute`/`batch` with the normalisation above. */
function sanitiseClient<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') {
        return value;
      }
      if (prop === 'execute') {
        return (statement: unknown, ...rest: unknown[]) =>
          value.call(target, sanitiseStatement(statement), ...rest);
      }
      if (prop === 'batch') {
        return (statements: unknown[], ...rest: unknown[]) =>
          value.call(target, statements.map(sanitiseStatement), ...rest);
      }
      if (prop === 'transaction') {
        // A transaction is another object with its own `execute`, so it needs the same care.
        return async (...args: unknown[]) => sanitiseClient(await value.apply(target, args));
      }
      return value.bind(target);
    },
  });
}

function createSqliteDb(): SqliteDb {
  const client = sanitiseClient(createClient({ url: process.env.DATABASE_URL! }));
  // Without foreign keys SQLite silently accepts a row pointing at an id that does not exist - Postgres
  // never did, and the schema counts on that. It is off by default.
  void client.execute('PRAGMA foreign_keys = ON');
  // It suits 2-5 clients: readers do not block one another; the file survives a process reboot without
  // losing the journal. Multi-instance production is still Postgres.
  void client.execute('PRAGMA journal_mode = WAL');
  return drizzleLibsql(client, { schema, logger: false });
}

export const databaseMigrationTarget = usingSqlite
  ? ({ dialect: 'sqlite', connection: createSqliteDb() } as const)
  : ({ dialect: 'postgres', connection: createPostgresDb() } as const);

const rawDb = exposeCompatibleDb(databaseMigrationTarget.connection);

/**
 * Makes a transaction implicitly visible to every call to the `db` exported below made during `fn` -
 * direct or indirect, at any call depth - without having to pass a `tx` parameter through any of the
 * synchronization handlers. They keep importing and calling `db` exactly as before; it is the Proxy
 * just below that resolves to the transaction active in this `AsyncLocalStorage` when there is one.
 */
const transactionContext = new AsyncLocalStorage<CompatibleDb>();

/**
 * Like `db.transaction(callback)`, but the `callback` runs with the transaction hidden in the async
 * context instead of received as a parameter. Nested calls join the active transaction, so an outer
 * rollback always covers work performed by inner services. Code that needs an independent savepoint
 * must call `db.transaction(...)`: through the Proxy below it resolves to the active transaction.
 */
export function withTransaction<T>(fn: (tx: CompatibleDb) => Promise<T>): Promise<T> {
  const activeTransaction = transactionContext.getStore();
  if (activeTransaction) {
    return fn(activeTransaction);
  }
  return rawDb.transaction((tx) => transactionContext.run(tx, () => fn(tx)));
}

/**
 * A Proxy over the ordinary connection: every property/method accessed resolves to the active
 * transaction (if a `withTransaction` is in progress in this async chain) or falls back to the
 * ordinary connection, without callers needing to know the difference or change a line. Methods are
 * rebound (`.bind`) to the resolved target because `proxy.method(...)` would bind `this` to the proxy
 * rather than to the object the method actually came from - without this, drizzle's internal methods
 * would break trying to read state from `this` in the wrong place.
 */
export const db: CompatibleDb = new Proxy<CompatibleDb>(rawDb, {
  get(target, prop) {
    const active = transactionContext.getStore() ?? target;
    const value = Reflect.get(active, prop, active);
    return typeof value === 'function' ? value.bind(active) : value;
  },
});
