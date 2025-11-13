PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`id_user` text NOT NULL,
	`user_name` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`last_sync_date` integer,
	`jwt_token` text,
	`refresh_token` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_servers`("id", "id_user", "user_name", "name", "url", "last_sync_date", "jwt_token", "refresh_token", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "id_user", "user_name", "name", "url", "last_sync_date", "jwt_token", "refresh_token", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `servers`;--> statement-breakpoint
DROP TABLE `servers`;--> statement-breakpoint
ALTER TABLE `__new_servers` RENAME TO `servers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;