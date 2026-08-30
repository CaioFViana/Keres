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
	`version` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_anchor_order_unique` ON `chapter_anchors` (`story_id`,`chapter_id`,`order`) WHERE "chapter_anchors"."is_deleted" = 0;