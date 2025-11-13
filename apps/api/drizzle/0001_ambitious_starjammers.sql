ALTER TABLE "users" RENAME COLUMN "id_user" TO "id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "display_name" TO "username";--> statement-breakpoint
ALTER TABLE "stories" DROP CONSTRAINT "stories_user_id_users_id_user_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password" text NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "id_server";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");