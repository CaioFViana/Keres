CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"field_id" text,
	"field_key" text,
	"content_snapshot" text,
	"excerpt_text" text,
	"author_user_id" text NOT NULL,
	"comment_text" text NOT NULL,
	"criticality" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "see_also_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"entity_a_type" text NOT NULL,
	"entity_a_id" text NOT NULL,
	"entity_b_type" text NOT NULL,
	"entity_b_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "see_also_story_a_b_unq" UNIQUE("story_id","entity_a_type","entity_a_id","entity_b_type","entity_b_id")
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "allow_reader_comments" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_field_id_story_schema_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."story_schema_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "see_also_relations" ADD CONSTRAINT "see_also_relations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;