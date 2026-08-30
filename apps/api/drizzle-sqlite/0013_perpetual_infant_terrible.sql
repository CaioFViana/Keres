CREATE TABLE `chapter_anchors` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`order` integer DEFAULT 1 NOT NULL,
	`start_scene_id` text NOT NULL,
	`start_position` text DEFAULT 'start' NOT NULL,
	`start_offset` integer,
	`start_offset_unit` text,
	`end_scene_id` text NOT NULL,
	`end_position` text DEFAULT 'end' NOT NULL,
	`end_offset` integer,
	`end_offset_unit` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`start_scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`end_scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `story_chapter_anchor_order_unq` ON `chapter_anchors` (`story_id`,`chapter_id`,`order`);