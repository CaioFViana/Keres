ALTER TABLE "stories" ADD COLUMN "is_nsfw" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_adult_verified" boolean DEFAULT false NOT NULL;