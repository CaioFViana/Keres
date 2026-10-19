CREATE TABLE "scene_music" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"rank" text NOT NULL,
	"song_id" text,
	"gallery_id" text,
	"role" text DEFAULT 'score' NOT NULL,
	"cue" text,
	"sections" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "scene_music" ADD CONSTRAINT "scene_music_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_music" ADD CONSTRAINT "scene_music_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scene_music_story_idx" ON "scene_music" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "scene_music_scene_idx" ON "scene_music" USING btree ("scene_id");