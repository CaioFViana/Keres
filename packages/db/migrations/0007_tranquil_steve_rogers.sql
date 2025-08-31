CREATE TABLE IF NOT EXISTS "choices" (
	"id" text PRIMARY KEY NOT NULL,
	"scene_id" text NOT NULL,
	"next_scene_id" text NOT NULL,
	"text" text NOT NULL,
	"is_implicit" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story" ADD COLUMN "type" text DEFAULT 'linear' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "choices" ADD CONSTRAINT "choices_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "choices" ADD CONSTRAINT "choices_next_scene_id_scenes_id_fk" FOREIGN KEY ("next_scene_id") REFERENCES "scenes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
