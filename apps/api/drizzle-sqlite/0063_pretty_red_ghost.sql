CREATE TABLE `access_records` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` integer NOT NULL,
	`user_id` text,
	`username_tried` text,
	`event` text NOT NULL,
	`ip` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `access_records_occurred_idx` ON `access_records` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `access_records_user_idx` ON `access_records` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `access_records_ip_idx` ON `access_records` (`ip`,`occurred_at`);--> statement-breakpoint
ALTER TABLE `audit_events` DROP COLUMN `ip`;--> statement-breakpoint
ALTER TABLE `audit_events` DROP COLUMN `user_agent`;