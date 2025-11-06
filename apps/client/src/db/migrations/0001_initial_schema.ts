import { SQLiteDatabase } from 'expo-sqlite';

export default async function migration(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS "stories" (
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

    CREATE TABLE IF NOT EXISTS "client_settings" (
      "id" text PRIMARY KEY NOT NULL,
      "local_username" text NOT NULL,
      "language" text NOT NULL,
      "dark_mode" integer NOT NULL,
      "created_at" integer NOT NULL,
      "updated_at" integer NOT NULL,
      "version" integer NOT NULL,
      "is_deleted" integer NOT NULL,
      "deleted_at" integer
    );
  `);
}
