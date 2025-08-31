CREATE TABLE IF NOT EXISTS "world_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "world_rules" ADD CONSTRAINT "world_rules_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
