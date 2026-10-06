CREATE TABLE "scene_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"rank" text NOT NULL,
	"sketch_id" text,
	"gallery_id" text,
	"fit" text DEFAULT 'contain' NOT NULL,
	"text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "scene_pages" ADD CONSTRAINT "scene_pages_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_pages" ADD CONSTRAINT "scene_pages_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scene_page_story_idx" ON "scene_pages" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "scene_page_scene_idx" ON "scene_pages" USING btree ("scene_id");