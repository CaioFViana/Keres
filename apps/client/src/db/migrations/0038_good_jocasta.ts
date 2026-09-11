import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "story_arcs" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL,
	"color" text,
	"icon" text,
	"theme_override" text,
	"is_default" integer DEFAULT false NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD "arc_id" text;
`);
}
