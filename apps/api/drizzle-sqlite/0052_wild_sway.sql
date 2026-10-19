CREATE TABLE `scene_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`rank` text NOT NULL,
	`sketch_id` text,
	`gallery_id` text,
	`fit` text DEFAULT 'contain' NOT NULL,
	`text` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scene_page_story_idx` ON `scene_pages` (`story_id`);--> statement-breakpoint
CREATE INDEX `scene_page_scene_idx` ON `scene_pages` (`scene_id`);