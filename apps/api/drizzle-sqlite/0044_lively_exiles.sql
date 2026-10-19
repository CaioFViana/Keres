ALTER TABLE `stories` ADD `is_nsfw` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `is_adult_verified` integer DEFAULT false NOT NULL;