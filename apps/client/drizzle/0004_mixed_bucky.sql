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
ALTER TABLE `stories` ADD `favorite_behavior` text DEFAULT 'global' NOT NULL;