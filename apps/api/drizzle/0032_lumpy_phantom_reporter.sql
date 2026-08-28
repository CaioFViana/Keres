CREATE TABLE "location_maps" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "location_maps" ADD CONSTRAINT "location_maps_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;