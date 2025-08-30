CREATE TABLE IF NOT EXISTS "gallery" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"owner_id" text,
	"image_path" text NOT NULL,
	"is_file" boolean DEFAULT false NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gallery" ADD CONSTRAINT "gallery_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
