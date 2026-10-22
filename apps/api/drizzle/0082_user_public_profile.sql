ALTER TABLE "users" ADD COLUMN "profile_biography" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_theme" text;