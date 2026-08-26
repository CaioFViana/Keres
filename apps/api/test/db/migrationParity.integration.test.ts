import { createClient } from '@libsql/client';
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { usingSqlite } from '../../src/db/dialect';
import * as schema from '../../src/db/schema';

/**
 * The SQLite migrations describe the same schema the code defines.
 *
 * Why it exists: there are two migration folders, one per engine, and both have to be generated
 * (`db:generate` and `db:generate:sqlite`). Forgetting the second breaks nothing in development on
 * Postgres - it only breaks the installation of somebody who chose SQLite, on the first boot, far from
 * whoever made the change. This test applies the SQLite migrations to a fresh file and compares table
 * by table, column by column, with what the schema declares.
 *
 * It only runs in SQLite mode: with Postgres active, `schema` builds tables of the other dialect and
 * the comparison would make no sense.
 */

const describeForSqlite = usingSqlite ? describe : describe.skip;

/** The tables as the code declares them. */
function declaredTables(): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  for (const value of Object.values(schema)) {
    // The barrel also exports relations, enums and constants; `is` is drizzle's own checker, and it is the
    // only reliable way to separate a table from the rest.
    if (!is(value, SQLiteTable)) {
      continue;
    }
    const config = getTableConfig(value);
    tables.set(config.name, new Set(config.columns.map((column) => column.name)));
  }
  return tables;
}

describeForSqlite('the SQLite migrations match the schema', () => {
  it('creates every table and column the code declares, and nothing extra', async () => {
    const file = path.join(os.tmpdir(), `keres-parity-${Date.now()}.db`);
    await rm(file, { force: true });

    const client = createClient({ url: `file:${file}` });
    try {
      const { drizzle } = await import('drizzle-orm/libsql');
      const { migrate } = await import('drizzle-orm/libsql/migrator');
      await migrate(drizzle(client), {
        migrationsFolder: path.join(
          path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
          '..',
          '..',
          'drizzle-sqlite',
        ),
      });

      const applied = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'",
      );
      const appliedNames = (applied.rows as unknown as Array<{ name: string }>)
        .map((row) => row.name)
        .sort();

      const declared = declaredTables();
      expect(appliedNames).toEqual([...declared.keys()].sort());

      for (const [tableName, declaredColumns] of declared) {
        const info = await client.execute(`PRAGMA table_info("${tableName}")`);
        const appliedColumns = (info.rows as unknown as Array<{ name: string }>)
          .map((row) => row.name)
          .sort();
        expect({ [tableName]: appliedColumns }).toEqual({
          [tableName]: [...declaredColumns].sort(),
        });
      }
    } finally {
      client.close();
      // On Windows the file stays locked for a moment after `close`; it is a temporary file, so failing to
      // delete it must not fail the test.
      await rm(file, { force: true }).catch(() => undefined);
    }
  });

  // drizzle's control table lives in the main database (on Postgres it is a separate schema), and it is
  // the one the cleanup between tests has to spare - see `truncateAll`.
  it('keeps its bookkeeping in __drizzle_migrations', async () => {
    const { db } = await import('../../src/db');
    const sqliteDb = db as unknown as { all: (query: unknown) => Promise<unknown> };
    const { sql } = await import('drizzle-orm');

    const rows = (await sqliteDb.all(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'`,
    )) as Array<{ name: string }>;

    expect(rows).toHaveLength(1);
  });
});
