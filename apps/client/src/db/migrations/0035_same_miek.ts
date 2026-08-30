import type { SQLiteDatabase } from 'expo-sqlite';

export default async function (db: SQLiteDatabase) {
  await db.execAsync(`
  CREATE TABLE "routes" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"details" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE TABLE "route_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"route_id" text NOT NULL,
	"position" integer NOT NULL,
	"scene_id" text NOT NULL,
	"selected_choice_id" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"version" integer NOT NULL,
	"is_deleted" integer NOT NULL,
	"deleted_at" integer
);
--> statement-breakpoint
CREATE INDEX "route_step_story_idx" ON "route_steps" ("story_id");--> statement-breakpoint
CREATE INDEX "route_step_route_idx" ON "route_steps" ("route_id");--> statement-breakpoint
CREATE UNIQUE INDEX "route_step_position_unique" ON "route_steps" ("route_id","position") WHERE "route_steps"."is_deleted" = false;
`);
}
