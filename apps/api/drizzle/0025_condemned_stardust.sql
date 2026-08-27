CREATE TABLE "chapter_anchors" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"chapter_id" text NOT NULL,
	"order" integer DEFAULT 1 NOT NULL,
	"start_scene_id" text NOT NULL,
	"start_position" text DEFAULT 'start' NOT NULL,
	"start_offset" integer,
	"start_offset_unit" text,
	"end_scene_id" text NOT NULL,
	"end_position" text DEFAULT 'end' NOT NULL,
	"end_offset" integer,
	"end_offset_unit" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "story_chapter_anchor_order_unq" UNIQUE("story_id","chapter_id","order")
);
--> statement-breakpoint
ALTER TABLE "chapter_anchors" ADD CONSTRAINT "chapter_anchors_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_anchors" ADD CONSTRAINT "chapter_anchors_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_anchors" ADD CONSTRAINT "chapter_anchors_start_scene_id_scenes_id_fk" FOREIGN KEY ("start_scene_id") REFERENCES "public"."scenes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_anchors" ADD CONSTRAINT "chapter_anchors_end_scene_id_scenes_id_fk" FOREIGN KEY ("end_scene_id") REFERENCES "public"."scenes"("id") ON DELETE no action ON UPDATE no action;