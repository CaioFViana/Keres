CREATE TABLE `story_calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`description` text,
	`definition` text NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
