import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE "__new_scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"location_id" text,
	"name" text NOT NULL,
	"index" integer NOT NULL,
	"summary" text,
	"gap" integer,
	"gap_type" text,
	"duration" integer,
	"duration_type" text,
	"is_start" integer DEFAULT false NOT NULL,
	"is_finish" integer DEFAULT false NOT NULL,
	"is_favorite" integer DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
INSERT INTO "__new_scenes"("id", "story_id", "chapter_id", "location_id", "name", "index", "summary", "gap", "gap_type", "duration", "duration_type", "is_start", "is_finish", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "chapter_id", "location_id", "name", "index", "summary", "gap", "gap_type", "duration", "duration_type", "is_start", "is_finish", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM "scenes";--> statement-breakpoint
DROP TABLE "scenes";--> statement-breakpoint
ALTER TABLE "__new_scenes" RENAME TO "scenes";--> statement-breakpoint
PRAGMA foreign_keys=ON;
`);
}
