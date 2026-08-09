CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorite_story_entity_user_unq` ON `favorites` (`story_id`,`entity_id`,`entity_type`,`user_id`);--> statement-breakpoint
ALTER TABLE `stories` ADD `favorite_behavior` text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE `stories` ADD `normalize_scene_timing` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `stories` ADD `last_public_favorite_log` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` DROP COLUMN `jwt_token`;--> statement-breakpoint
ALTER TABLE `servers` DROP COLUMN `refresh_token`;--> statement-breakpoint
ALTER TABLE `suggestions` DROP COLUMN `is_default`;