CREATE TABLE `publication_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`story_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `publication_log_user_idx` ON `publication_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `publication_log_created_idx` ON `publication_log` (`created_at`);--> statement-breakpoint
ALTER TABLE `tiers` ADD `max_publications_per_day` integer;