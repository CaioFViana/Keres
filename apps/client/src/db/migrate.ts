import * as SQLite from 'expo-sqlite';

const MIGRATION_SQL = `
CREATE TABLE "stories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"genre" text,
	"language" text,
	"is_favorite" integer NOT NULL,
	"extra_notes" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer,
	"server_id" text
);
`;

const MIGRATION_NAME = '0000_shocking_mister_sinister'; // Name of the migration file

export const migrateDb = async (db: SQLite.SQLiteDatabase) => {
  console.log('migrateDb: Starting database migration...');
  try {
    // Check if 'stories' table already exists
    console.log('migrateDb: Checking if "stories" table exists...');
    const storiesTableExists = await db.getFirstAsync<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name='stories';`);
    console.log('migrateDb: "stories" table exists check result:', storiesTableExists);

    if (storiesTableExists) {
      console.log('migrateDb: "stories" table already exists. Assuming migration was applied.');
      // Ensure _migrations table exists and mark this migration as applied if not already
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS _migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );`
      );
      const migrationRecord = await db.getFirstAsync<{ name: string }>(`SELECT name FROM _migrations WHERE name = ?;`, MIGRATION_NAME);
      if (!migrationRecord) {
        await db.runAsync(`INSERT INTO _migrations (name) VALUES (?);`, MIGRATION_NAME);
        console.log(`migrateDb: Migration '${MIGRATION_NAME}' recorded as applied.`);
      } else {
        console.log(`migrateDb: Migration '${MIGRATION_NAME}' already recorded.`);
      }
      return; // Exit, as table is already there and migration is recorded
    }

    // If 'stories' table does not exist, proceed with normal migration logic
    console.log('migrateDb: "stories" table does not exist. Proceeding with migration.');

    // Create migrations table if it doesn't exist
    console.log('migrateDb: Attempting to create _migrations table if not exists...');
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );`
    );
    console.log('migrateDb: _migrations table checked/created.');

    // Check if the current migration has already been applied (should not be, but for safety)
    console.log(`migrateDb: Checking if migration '${MIGRATION_NAME}' has been applied...`);
    const result = await db.getFirstAsync<{ name: string }>(`SELECT name FROM _migrations WHERE name = ?;`, MIGRATION_NAME);
    console.log(`migrateDb: Query result for migration '${MIGRATION_NAME}':`, result);

    if (result) {
      console.log(`migrateDb: Migration '${MIGRATION_NAME}' already applied. Skipping.`);
      return; // Migration already applied, exit
    }

    console.log('migrateDb: Executing SQL:', MIGRATION_SQL);
    await db.execAsync(MIGRATION_SQL);

    // Record the migration as applied
    console.log(`migrateDb: Recording migration '${MIGRATION_NAME}' as applied...`);
    await db.runAsync(`INSERT INTO _migrations (name) VALUES (?);`, MIGRATION_NAME);
    console.log(`migrateDb: Migration '${MIGRATION_NAME}' recorded successfully.`);
  } catch (error) {
    console.error('migrateDb: Error migrating database:', error);
    throw error;
  }
};
