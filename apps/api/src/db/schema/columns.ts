import * as pg from 'drizzle-orm/pg-core';
import * as sqlite from 'drizzle-orm/sqlite-core';
import { usingSqlite } from '../dialect';

/**
 * Drizzle exposes separate generic types for equivalent PostgreSQL and SQLite builders. Runtime
 * compatibility is established by the modes selected in this module; keep the type bridge here so
 * services and table definitions never need a dialect assertion of their own.
 */
function asPostgresCompatible<T>(builder: unknown): T {
  return builder as T;
}

/**
 * One table definition, two dialects.
 *
 * drizzle has no dialect-agnostic schema: `pgTable` and `sqliteTable` are different builders, with
 * different column types. Instead of keeping two copies of the 40 tables - which would inevitably
 * diverge - each table file imports its builders from here, and it is this module that picks the
 * dialect, once, from `DATABASE_DRIVER`.
 *
 * The declared types are Postgres's, which is the reference dialect. That is not a convenient lie:
 * the SQLite modes below were chosen precisely so each column's *inferred* type is identical on both
 * sides - `timestamp` returns `Date`, `boolean` returns `boolean`, `json` returns the object. A
 * service cannot tell the difference, which is why none of them had to change.
 *
 * What SQLite does not have:
 *   - a `timestamp` type: it becomes an integer in milliseconds (`timestamp_ms`), converted to and
 *     from `Date` by drizzle. Milliseconds, not seconds, because synchronization orders operations
 *     by `updatedAt` - truncating to the second would tie nearby writes;
 *   - a `boolean` type: it becomes a 0/1 integer, converted the same way;
 *   - `jsonb`: it becomes text, serialised by drizzle;
 *   - ENUM types: they become text with the list of valid values in the TypeScript type;
 *   - a distinct 64-bit `bigint`: `INTEGER` is already 64 bits.
 */

/** `pgTable`/`sqliteTable`. The signature is the same in both. */
export const table = asPostgresCompatible<typeof pg.pgTable>(
  usingSqlite ? sqlite.sqliteTable : pg.pgTable,
);

export const text = asPostgresCompatible<typeof pg.text>(usingSqlite ? sqlite.text : pg.text);

export const integer = asPostgresCompatible<typeof pg.integer>(
  usingSqlite ? sqlite.integer : pg.integer,
);

/**
 * A number with decimals. `real` exists in both dialects and the inferred type is `number` on both
 * sides, so services cannot tell the difference - the same criterion as the columns above.
 */
export const real = asPostgresCompatible<typeof pg.real>(usingSqlite ? sqlite.real : pg.real);

/** A 64-bit integer. SQLite's `INTEGER` is already 64 bits; on Postgres it is `bigint`. */
export const bigintNumber = asPostgresCompatible<
  (name: string) => ReturnType<typeof pg.bigint<string, 'number'>>
>(
  usingSqlite
    ? (name: string) => sqlite.integer(name)
    : (name: string) => pg.bigint(name, { mode: 'number' })
);

export const boolean = asPostgresCompatible<typeof pg.boolean>(
  usingSqlite ? (name: string) => sqlite.integer(name, { mode: 'boolean' }) : pg.boolean
);

/** A nullable date/time. */
export const timestamp = asPostgresCompatible<typeof pg.timestamp>(
  usingSqlite ? (name: string) => sqlite.integer(name, { mode: 'timestamp_ms' }) : pg.timestamp
);

/**
 * A required date/time, filled with "now" when the inserter does not provide one.
 *
 * It exists as a builder of its own because `.defaultNow()` only exists in Postgres, and the pattern
 * `timestamp(...).notNull().defaultNow()` shows up 70-odd times: chaining methods returns a new
 * builder at every step, so there is no way to add `defaultNow` to SQLite's without wrapping
 * everything in a proxy. On SQLite the value comes from the process itself (`$defaultFn`), which
 * amounts to the same thing for whoever inserts through drizzle - and that is the only path here,
 * since no write in this API is done in raw SQL.
 */
export const timestampNow = asPostgresCompatible<
  (name: string) => ReturnType<ReturnType<ReturnType<typeof pg.timestamp>['notNull']>['defaultNow']>
>(
  usingSqlite
    ? (name: string) =>
        sqlite
          .integer(name, { mode: 'timestamp_ms' })
          .notNull()
          .$defaultFn(() => new Date())
    : (name: string) => pg.timestamp(name).notNull().defaultNow()
);

/** Documento JSON. `jsonb` no Postgres, texto serializado pelo drizzle no SQLite. */
export const json = asPostgresCompatible<typeof pg.jsonb>(
  usingSqlite ? (name: string) => sqlite.text(name, { mode: 'json' }) : pg.jsonb
);

export const index = asPostgresCompatible<typeof pg.index>(usingSqlite ? sqlite.index : pg.index);

export const uniqueIndex = asPostgresCompatible<typeof pg.uniqueIndex>(
  usingSqlite ? sqlite.uniqueIndex : pg.uniqueIndex
);

export const unique = asPostgresCompatible<typeof pg.unique>(usingSqlite ? sqlite.unique : pg.unique);

/**
 * Uma tabela sob outro nome, para a mesma tabela aparecer duas vezes numa consulta.
 * `FriendshipService` usa isso para juntar `users` com ela mesma (quem enviou e quem recebeu).
 */
export const alias = asPostgresCompatible<typeof pg.alias>(usingSqlite ? sqlite.alias : pg.alias);

/**
 * A closed set of values.
 *
 * On Postgres it is a real ENUM type; on SQLite it is a text column whose TypeScript type is the
 * union of the values - the database does not refuse a value outside the list, but the compiler does,
 * and every write goes through drizzle.
 *
 * `enumValues` is exposed because some routes build their validation schema from it
 * (`story.route.ts`, `SyncService`), and that has to work the same in both dialects.
 */
export function dbEnum<const T extends readonly [string, ...string[]]>(name: string, values: T) {
  const pgType = pg.pgEnum(name, values);
  // On Postgres `pgEnum` is itself the column builder - returning it untouched keeps the `CREATE TYPE`
  // in the migrations. On SQLite, text with the union of values in the type.
  const column = usingSqlite
    ? (columnName: string) => sqlite.text(columnName, { enum: values })
    : pgType;

  return asPostgresCompatible<typeof pgType>(Object.assign(column, { enumValues: values }));
}
