CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`index` integer NOT NULL,
	`summary` text,
	`is_favorite` integer NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `character_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`char_id_1` text NOT NULL,
	`char_id_2` text NOT NULL,
	`relation_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `character_scenes` (
	`character_id` text NOT NULL,
	`story_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
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
	`is_favorite` integer NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `choices` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`next_scene_id` text NOT NULL,
	`text` text NOT NULL,
	`is_implicit` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `client_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`local_username` text NOT NULL,
	`language` text NOT NULL,
	`dark_mode` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `galleries` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`image_path` text NOT NULL,
	`is_favorite` integer NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`climate` text,
	`culture` text,
	`politics` text,
	`is_favorite` integer NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`gallery_id` text,
	`is_favorite` integer NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `scenes` (
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
	`is_favorite` integer NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`type` text NOT NULL,
	`value` text NOT NULL,
	`is_default` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`is_favorite` integer NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer,
	`source_server_id` text
);
--> statement-breakpoint
CREATE TABLE `world_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`is_favorite` integer NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
