CREATE TYPE "public"."api_log_level" AS ENUM('info', 'warn', 'error');--> statement-breakpoint
CREATE TABLE "api_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"level" "api_log_level" NOT NULL,
	"message" text NOT NULL,
	"meta" jsonb,
	"user_id" text,
	"story_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_logs_story_id_idx" ON "api_logs" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "api_logs_user_id_idx" ON "api_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_logs_created_at_idx" ON "api_logs" USING btree ("created_at" desc);--> statement-breakpoint
CREATE INDEX "api_logs_level_idx" ON "api_logs" USING btree ("level");