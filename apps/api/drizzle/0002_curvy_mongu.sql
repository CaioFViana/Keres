CREATE TYPE "public"."operation_type" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TABLE "operation_log" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"operation_version" integer NOT NULL,
	"operation_type" "operation_type" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operation_log" ADD CONSTRAINT "operation_log_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;