PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_stories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`genre` text,
	`language` text,
	`is_favorite` integer NOT NULL,
	`extra_notes` text,
	`theme` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer,
	`server_id` text,
	`last_operation_log` integer DEFAULT 0 NOT NULL,
	`last_server_synced_log` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_stories`("id", "user_id", "title", "type", "description", "genre", "language", "is_favorite", "extra_notes", "theme", "created_at", "updated_at", "version", "is_deleted", "deleted_at", "server_id", "last_operation_log", "last_server_synced_log") SELECT "id", "user_id", "title", "type", "description", "genre", "language", "is_favorite", "extra_notes", "theme", "created_at", "updated_at", "version", "is_deleted", "deleted_at", "server_id", "last_operation_log", "last_server_synced_log" FROM `stories`;--> statement-breakpoint
DROP TABLE `stories`;--> statement-breakpoint
ALTER TABLE `__new_stories` RENAME TO `stories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;