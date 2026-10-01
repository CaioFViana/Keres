CREATE TABLE "publication_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"story_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tiers" ADD COLUMN "max_publications_per_day" integer;--> statement-breakpoint
CREATE INDEX "publication_log_user_idx" ON "publication_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "publication_log_created_idx" ON "publication_log" USING btree ("created_at");