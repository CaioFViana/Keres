CREATE TABLE `story_arcs` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`color` text,
	`icon` text,
	`theme_override` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `chapters` ADD `arc_id` text;