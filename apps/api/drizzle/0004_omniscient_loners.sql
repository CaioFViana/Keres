CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"gender" text,
	"race" text,
	"subrace" text,
	"description" text,
	"personality" text,
	"motivation" text,
	"qualities" text,
	"weaknesses" text,
	"biography" text,
	"planned_timeline" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;