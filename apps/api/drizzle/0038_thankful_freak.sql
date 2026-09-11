CREATE TABLE "story_arcs" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"color" text,
	"icon" text,
	"theme_override" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "arc_id" text;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD CONSTRAINT "story_arcs_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;