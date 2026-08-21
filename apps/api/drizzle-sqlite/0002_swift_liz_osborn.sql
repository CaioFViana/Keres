PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`meta` text,
	`user_id` text,
	`story_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_api_logs`("id", "level", "message", "meta", "user_id", "story_id", "created_at") SELECT "id", "level", "message", "meta", "user_id", "story_id", "created_at" FROM `api_logs`;--> statement-breakpoint
DROP TABLE `api_logs`;--> statement-breakpoint
ALTER TABLE `__new_api_logs` RENAME TO `api_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `api_logs_story_id_idx` ON `api_logs` (`story_id`);--> statement-breakpoint
CREATE INDEX `api_logs_user_id_idx` ON `api_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `api_logs_created_at_idx` ON `api_logs` ("created_at" desc);--> statement-breakpoint
CREATE INDEX `api_logs_level_idx` ON `api_logs` (`level`);