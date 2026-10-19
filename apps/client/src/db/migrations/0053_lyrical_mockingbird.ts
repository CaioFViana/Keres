import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "scene_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"rank" text NOT NULL,
	"sketch_id" text,
	"gallery_id" text,
	"fit" text DEFAULT 'contain' NOT NULL,
	"text" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE INDEX "scene_page_story_idx" ON "scene_pages" ("story_id");--> statement-breakpoint
CREATE INDEX "scene_page_scene_idx" ON "scene_pages" ("scene_id");
`);
}
