CREATE TYPE "public"."story_permission_type" AS ENUM('reader', 'writer');--> statement-breakpoint
CREATE TABLE "story_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"user_id" text NOT NULL,
	"permission_type" "story_permission_type" NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "story_permissions" ADD CONSTRAINT "story_permissions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_permissions" ADD CONSTRAINT "story_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;