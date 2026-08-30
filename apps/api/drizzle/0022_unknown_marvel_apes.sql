CREATE TABLE "chapter_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"chapter1_id" text NOT NULL,
	"chapter2_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "story_chapter1_chapter2_unq" UNIQUE("story_id","chapter1_id","chapter2_id")
);
--> statement-breakpoint
ALTER TABLE "chapter_relations" ADD CONSTRAINT "chapter_relations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_relations" ADD CONSTRAINT "chapter_relations_chapter1_id_chapters_id_fk" FOREIGN KEY ("chapter1_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_relations" ADD CONSTRAINT "chapter_relations_chapter2_id_chapters_id_fk" FOREIGN KEY ("chapter2_id") REFERENCES "public"."chapters"("id") ON DELETE no action ON UPDATE no action;