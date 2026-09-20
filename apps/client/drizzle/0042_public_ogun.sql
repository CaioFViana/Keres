CREATE TABLE `editor_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editor_draft_owner_unique` ON `editor_drafts` (`story_id`,`entity_type`,`entity_id`,`field`);