import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
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

`);
}
