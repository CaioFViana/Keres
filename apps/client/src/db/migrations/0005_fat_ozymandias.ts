import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "choice_check_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"choice_id" text NOT NULL,
	"combinator" text NOT NULL,
	"order" integer NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer,
	FOREIGN KEY ("choice_id") REFERENCES "choices"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE "choice_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"group_id" text NOT NULL,
	"mode" text NOT NULL,
	"type" text NOT NULL,
	"order" integer NOT NULL,
	"scene_id" text,
	"min_visits" integer,
	"item_id" text,
	"item_presence" text,
	"trigger_name" text,
	"trigger_state" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer,
	FOREIGN KEY ("group_id") REFERENCES "choice_check_groups"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON UPDATE no action ON DELETE no action,
	FOREIGN KEY ("item_id") REFERENCES "items"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE "effects" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"effect_type" text NOT NULL,
	"item_id" text,
	"trigger_name" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer,
	FOREIGN KEY ("item_id") REFERENCES "items"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE "choices" ADD "notes" text;
`);
}
