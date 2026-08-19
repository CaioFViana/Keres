CREATE TYPE "public"."publication_label_mode" AS ENUM('version', 'date', 'both');--> statement-breakpoint
CREATE TYPE "public"."showcase_visibility" AS ENUM('public', 'password');--> statement-breakpoint
CREATE TABLE "showcase_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"is_showcase_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_publications" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"label" text NOT NULL,
	"operation_version" integer NOT NULL,
	"format_version" integer NOT NULL,
	"byte_size" bigint NOT NULL,
	"media_included" integer DEFAULT 0 NOT NULL,
	"media_total" integer DEFAULT 0 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "story_publication_label_unq" UNIQUE("story_id","label")
);
--> statement-breakpoint
CREATE TABLE "story_showcase_entries" (
	"story_id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"visibility" "showcase_visibility" DEFAULT 'public' NOT NULL,
	"password_hash" text,
	"label_mode" "publication_label_mode" DEFAULT 'both' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "story_publications" ADD CONSTRAINT "story_publications_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_publications" ADD CONSTRAINT "story_publications_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_showcase_entries" ADD CONSTRAINT "story_showcase_entries_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_showcase_entries" ADD CONSTRAINT "story_showcase_entries_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "story_publication_story_idx" ON "story_publications" USING btree ("story_id");