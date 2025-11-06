import { SQLiteDatabase } from 'expo-sqlite';
// Removed: import { sql } from 'drizzle-orm';

// Import all migration files
import migration_0001 from './migrations/0001_initial_schema';

const migrations = [
  { id: 1, name: '0001_initial_schema', run: migration_0001 },
  // Add new migrations here in order
];

export async function migrate(expoDb: SQLiteDatabase) { // Renamed db to expoDb for clarity
  console.log('migrate: Starting custom Drizzle client-side migrations...');

  // Ensure _migrations table exists
  await expoDb.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);

  const appliedMigrations = await expoDb.getAllAsync<{ name: string }>(`SELECT name FROM _migrations`);
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
  console.log('migrate: All pending migrations applied.');
}