CREATE TYPE "public"."story_type" AS ENUM('linear', 'branching');--> statement-breakpoint
CREATE TABLE "stories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"type" "story_type" NOT NULL,
	"description" text,
	"genre" text,
	"language" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"extra_notes" text,
	"theme" text,
	"server_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id_user" text PRIMARY KEY NOT NULL,
	"id_server" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_users_id_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id_user") ON DELETE no action ON UPDATE no action;