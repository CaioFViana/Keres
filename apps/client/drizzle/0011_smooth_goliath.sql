ALTER TABLE `tag_relations` RENAME COLUMN "entity_id" TO "relation_id";--> statement-breakpoint
ALTER TABLE `tag_relations` RENAME COLUMN "entity_type" TO "relation_type";--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`is_default` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_suggestions`("id", "story_id", "type", "value", "is_default", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "type", "value", "is_default", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `suggestions`;--> statement-breakpoint
DROP TABLE `suggestions`;--> statement-breakpoint
ALTER TABLE `__new_suggestions` RENAME TO `suggestions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;