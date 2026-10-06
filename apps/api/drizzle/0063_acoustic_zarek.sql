ALTER TABLE "stories" ADD COLUMN "cover_gallery_id" text;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD COLUMN "medium" text DEFAULT 'generic' NOT NULL;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD COLUMN "vocabulary" jsonb;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD COLUMN "author" text;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD COLUMN "cover_gallery_id" text;