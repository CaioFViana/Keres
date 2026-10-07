import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "songs" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"lyrics" text DEFAULT '' NOT NULL,
	"lyrics_translation" text,
	"melody" text,
	"key" text,
	"tempo" integer,
	"meter" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE INDEX "song_story_idx" ON "songs" ("story_id");
`);
}
