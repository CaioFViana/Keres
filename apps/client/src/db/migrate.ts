import type { SQLiteDatabase } from 'expo-sqlite';

import migrations from './migrations/index';

/**
 * Applies pending client-side migrations in order, recording each in `_migrations`.
 *
 * Unlike the server's migration runner, this one is hand-rolled against expo-sqlite:
 * it diffs the generated migration list against the `_migrations` table and runs only
 * what is missing, so re-opening the database is a no-op once everything is applied.
 * A failing migration aborts startup (the error is rethrown) rather than leaving a
 * half-migrated schema behind.
 */
export async function migrate(expoDb: SQLiteDatabase) {
  console.log('migrate: Starting custom Drizzle client-side migrations...');

  await expoDb.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  const appliedMigrations = await expoDb.getAllAsync<{ name: string }>(
    `SELECT name FROM _migrations`,
  );
  const appliedMigrationNames = new Set(appliedMigrations.map((m) => m.name));

  for (const migration of migrations) {
    if (!appliedMigrationNames.has(migration.name)) {
      console.log(`migrate: Applying migration: ${migration.name}`);
      try {
        await migration.run(expoDb);
        await expoDb.runAsync(`INSERT INTO _migrations (name) VALUES (?)`, migration.name);
        console.log(`migrate: Successfully applied migration: ${migration.name}`);
      } catch (error) {
        console.error(`migrate: Failed to apply migration ${migration.name}:`, error);
        throw error;
      }
    }
  }

  // Links carry only a URL, so no local file can ever be pending. Older imports accidentally
  // marked them as downloads; repair those rows idempotently while opening the database.
  await expoDb.execAsync(`
    UPDATE galleries
    SET upload_state = 'uploaded', download_state = 'downloaded'
    WHERE media_type = 'link'
      AND (upload_state <> 'uploaded' OR download_state <> 'downloaded');
  `);
  console.log('migrate: All pending migrations applied.');
}
