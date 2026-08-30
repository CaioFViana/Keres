ALTER TABLE "chapter_anchors" ALTER COLUMN "end_scene_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chapter_anchors" ALTER COLUMN "end_position" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "chapter_anchors" ALTER COLUMN "end_position" DROP NOT NULL;