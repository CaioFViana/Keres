CREATE TABLE `location_maps` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
