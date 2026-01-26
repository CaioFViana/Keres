ALTER TYPE "public"."operation_type" ADD VALUE 'reorder';--> statement-breakpoint
ALTER TABLE "item_journeys" DROP CONSTRAINT "story_item_scene_unq";