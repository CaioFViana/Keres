import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "tag_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"character_owner_id" text,
	"name" text NOT NULL,
	"category" text,
	"description" text,
	"initial_state" text,
	"is_favorite" integer NOT NULL,
	"extra_notes" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE TABLE "item_journeys" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"item_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"new_character_owner_id" text,
	"new_state" text NOT NULL,
	"extra_notes" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE "__new_character_scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"story_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
INSERT INTO "__new_character_scenes"("id", "character_id", "story_id", "scene_id", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "character_id", "story_id", "scene_id", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM "character_scenes";--> statement-breakpoint
DROP TABLE "character_scenes";--> statement-breakpoint
ALTER TABLE "__new_character_scenes" RENAME TO "character_scenes";--> statement-breakpoint
PRAGMA foreign_keys=ON;
`);
}
