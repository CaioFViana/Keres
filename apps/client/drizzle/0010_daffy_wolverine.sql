PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_stories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`genre` text,
	`language` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`theme` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer,
	`server_id` text,
	`last_operation_log` integer DEFAULT 0 NOT NULL,
	`last_server_synced_log` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_stories`("id", "user_id", "title", "type", "description", "genre", "language", "is_favorite", "extra_notes", "theme", "created_at", "updated_at", "version", "is_deleted", "deleted_at", "server_id", "last_operation_log", "last_server_synced_log") SELECT "id", "user_id", "title", "type", "description", "genre", "language", "is_favorite", "extra_notes", "theme", "created_at", "updated_at", "version", "is_deleted", "deleted_at", "server_id", "last_operation_log", "last_server_synced_log" FROM `stories`;--> statement-breakpoint
DROP TABLE `stories`;--> statement-breakpoint
ALTER TABLE `__new_stories` RENAME TO `stories`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`index` integer NOT NULL,
	`summary` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_chapters`("id", "story_id", "name", "index", "summary", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "name", "index", "summary", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `chapters`;--> statement-breakpoint
DROP TABLE `chapters`;--> statement-breakpoint
ALTER TABLE `__new_chapters` RENAME TO `chapters`;--> statement-breakpoint
CREATE TABLE `__new_scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`location_id` text NOT NULL,
	`name` text NOT NULL,
	`index` integer NOT NULL,
	`summary` text,
	`gap` integer,
	`gap_type` text,
	`duration` integer,
	`duration_type` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_scenes`("id", "story_id", "chapter_id", "location_id", "name", "index", "summary", "gap", "gap_type", "duration", "duration_type", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "chapter_id", "location_id", "name", "index", "summary", "gap", "gap_type", "duration", "duration_type", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `scenes`;--> statement-breakpoint
DROP TABLE `scenes`;--> statement-breakpoint
ALTER TABLE `__new_scenes` RENAME TO `scenes`;--> statement-breakpoint
CREATE TABLE `__new_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`gender` text,
	`race` text,
	`subrace` text,
	`description` text,
	`personality` text,
	`motivation` text,
	`qualities` text,
	`weaknesses` text,
	`biography` text,
	`planned_timeline` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_characters`("id", "story_id", "name", "title", "gender", "race", "subrace", "description", "personality", "motivation", "qualities", "weaknesses", "biography", "planned_timeline", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "name", "title", "gender", "race", "subrace", "description", "personality", "motivation", "qualities", "weaknesses", "biography", "planned_timeline", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `characters`;--> statement-breakpoint
DROP TABLE `characters`;--> statement-breakpoint
ALTER TABLE `__new_characters` RENAME TO `characters`;--> statement-breakpoint
CREATE TABLE `__new_galleries` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`image_path` text NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_galleries`("id", "story_id", "owner_id", "image_path", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "owner_id", "image_path", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `galleries`;--> statement-breakpoint
DROP TABLE `galleries`;--> statement-breakpoint
ALTER TABLE `__new_galleries` RENAME TO `galleries`;--> statement-breakpoint
CREATE TABLE `__new_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`climate` text,
	`culture` text,
	`politics` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_locations`("id", "story_id", "name", "description", "climate", "culture", "politics", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "name", "description", "climate", "culture", "politics", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `locations`;--> statement-breakpoint
DROP TABLE `locations`;--> statement-breakpoint
ALTER TABLE `__new_locations` RENAME TO `locations`;--> statement-breakpoint
CREATE TABLE `__new_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`gallery_id` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_notes`("id", "story_id", "title", "body", "gallery_id", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "title", "body", "gallery_id", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `notes`;--> statement-breakpoint
DROP TABLE `notes`;--> statement-breakpoint
ALTER TABLE `__new_notes` RENAME TO `notes`;--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_tags`("id", "story_id", "name", "color", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "name", "color", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
CREATE TABLE `__new_world_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_world_rules`("id", "story_id", "title", "description", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "title", "description", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `world_rules`;--> statement-breakpoint
DROP TABLE `world_rules`;--> statement-breakpoint
ALTER TABLE `__new_world_rules` RENAME TO `world_rules`;--> statement-breakpoint
CREATE TABLE `__new_items` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`character_owner_id` text,
	`name` text NOT NULL,
	`category` text,
	`description` text,
	`initial_state` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_items`("id", "story_id", "character_owner_id", "name", "category", "description", "initial_state", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "story_id", "character_owner_id", "name", "category", "description", "initial_state", "is_favorite", "extra_notes", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `items`;--> statement-breakpoint
DROP TABLE `items`;--> statement-breakpoint
ALTER TABLE `__new_items` RENAME TO `items`;--> statement-breakpoint
ALTER TABLE `operation_logs` ADD `is_synced` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `operation_logs` ADD `server_operation_version` integer DEFAULT 0;