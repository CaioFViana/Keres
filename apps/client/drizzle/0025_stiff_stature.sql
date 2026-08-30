PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chapter_anchors` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`order` integer DEFAULT 1 NOT NULL,
	`start_scene_id` text NOT NULL,
	`start_position` text DEFAULT 'start' NOT NULL,
	`start_offset` integer,
	`start_offset_unit` text,
	`end_scene_id` text,
	`end_position` text,
	`end_offset` integer,
	`end_offset_unit` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_chapter_anchors`("id", "story_id", "chapter_id", "order", "start_scene_id", "start_position", "start_offset", "start_offset_unit", "end_scene_id", "end_position", "end_offset", "end_offset_unit", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "chapter_id", "order", "start_scene_id", "start_position", "start_offset", "start_offset_unit", "end_scene_id", "end_position", "end_offset", "end_offset_unit", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `chapter_anchors`;--> statement-breakpoint
DROP TABLE `chapter_anchors`;--> statement-breakpoint
ALTER TABLE `__new_chapter_anchors` RENAME TO `chapter_anchors`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_anchor_order_unique` ON `chapter_anchors` (`story_id`,`chapter_id`,`order`) WHERE "chapter_anchors"."is_deleted" = 0;