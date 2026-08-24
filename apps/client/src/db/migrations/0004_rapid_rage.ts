import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field_id" text,
	"field_key" text,
	"content_snapshot" text,
	"excerpt_text" text,
	"author_user_id" text NOT NULL,
	"comment_text" text NOT NULL,
	"criticality" integer NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer DEFAULT false NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE TABLE "see_also_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"entity_a_type" text NOT NULL,
	"entity_a_id" text NOT NULL,
	"entity_b_type" text NOT NULL,
	"entity_b_id" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer DEFAULT false NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX "see_also_story_a_b_unq" ON "see_also_relations" ("story_id","entity_a_type","entity_a_id","entity_b_type","entity_b_id");--> statement-breakpoint
ALTER TABLE "stories" ADD "allow_reader_comments" integer DEFAULT false NOT NULL;
`);
}
