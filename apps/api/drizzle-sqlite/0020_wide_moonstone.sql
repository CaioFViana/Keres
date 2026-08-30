CREATE TABLE `location_maps` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action
);
