import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { usingSqlite } from '../../src/db/dialect';
import { users } from '../../src/db/schema';

/**
 * Promotes a user to admin by writing straight to the table.
 *
 * There is no route for that on purpose - in production the root admin comes from
 * `ROOT_ADMIN_USERNAME`/`ROOT_ADMIN_PASSWORD`, reconciled at boot, which is precisely the path
 * `createApp()` does not run. Touching the column is the closest equivalent.
 */
export async function promoteToAdmin(userId: string): Promise<void> {
  await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
}

/** Marks the user as deleted, to exercise `requireAdmin`'s gate. */
export async function softDeleteUser(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Empties every table between tests.
 *
 * It reads the list from the catalog itself rather than enumerating drizzle's schema: a new table
 * starts being cleaned automatically, with nobody having to remember to update this list.
 * `__drizzle_migrations` is left out on both engines - the migrations stay applied.
 */
export async function truncateAll(): Promise<void> {
  if (usingSqlite) {
    await truncateAllSqlite();
    return;
  }

  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );

  const tables = result.rows.map((row) => `"public"."${row.tablename}"`);
  if (tables.length === 0) {
    return;
  }

  await db.execute(sql.raw(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`));
}

/**
 * SQLite has neither `TRUNCATE` nor `CASCADE`, so it is `DELETE` table by table - with foreign keys
 * turned off during the cleanup, since without `CASCADE` the order would start to matter.
 */
async function truncateAllSqlite(): Promise<void> {
  // `db` is typed as the Postgres connection (see src/db/index.ts); `all`/`run` are the methods only
  // the SQLite driver exposes, and this block only runs when that is the active one.
  const sqliteDb = db as unknown as {
    all: (query: unknown) => Promise<unknown>;
    run: (query: unknown) => Promise<unknown>;
  };

  const rows = (await sqliteDb.all(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
  )) as Array<{ name: string }>;

  await sqliteDb.run(sql`PRAGMA foreign_keys = OFF`);
  try {
    for (const { name } of rows) {
      await sqliteDb.run(sql.raw(`DELETE FROM "${name}"`));
    }
  } finally {
    await sqliteDb.run(sql`PRAGMA foreign_keys = ON`);
  }
}
