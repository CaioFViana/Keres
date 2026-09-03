import type { SQLiteDatabase } from 'expo-sqlite';

// Import all migration files dynamically
import migrations from './migrations/index'; // Import the generated migrations array

export async function migrate(expoDb: SQLiteDatabase) {
  // Renamed db to expoDb for clarity
  console.log('migrate: Starting custom Drizzle client-side migrations...');

  // Ensure _migrations table exists
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
    // Use the dynamically imported migrations
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
