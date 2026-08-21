import { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "modes" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"character_id" text NOT NULL,
	"name" text NOT NULL,
	"mode_changes" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer DEFAULT false NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE TABLE "stat_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"character_id" text NOT NULL,
	"mode_id" text,
	"stat_id" text NOT NULL,
	"value" real NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer DEFAULT false NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE INDEX "stat_relation_owner_idx" ON "stat_relations" ("story_id","character_id","mode_id");--> statement-breakpoint
CREATE TABLE "stat_strengths" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"stat_id" text,
	"label" text NOT NULL,
	"min_value" real NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer DEFAULT false NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE INDEX "stat_strength_ladder_idx" ON "stat_strengths" ("story_id","stat_id");--> statement-breakpoint
CREATE TABLE "stats" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"is_primary" integer DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer DEFAULT false NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
ALTER TABLE "stories" ADD "stat_system" integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD "stat_notation" text DEFAULT 'letter' NOT NULL;
`);
}
