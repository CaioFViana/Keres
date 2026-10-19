CREATE TABLE "songs" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"lyrics" text DEFAULT '' NOT NULL,
	"lyrics_translation" text,
	"melody" text,
	"key" text,
	"tempo" integer,
	"meter" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "song_story_idx" ON "songs" USING btree ("story_id");