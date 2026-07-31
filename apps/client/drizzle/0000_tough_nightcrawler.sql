CREATE TABLE `chapters` (
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
CREATE TABLE `characters` (
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
CREATE TABLE `character_scenes` (
	`id` text PRIMARY KEY NOT NULL,
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
CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`friend_username` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id_user`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id_user`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sender_receiver_unq` ON `friendships` (`sender_id`,`receiver_id`);--> statement-breakpoint
CREATE TABLE `galleries` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`media_type` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_name` text NOT NULL,
	`hash` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`title` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer,
	`local_path` text,
	`upload_state` text DEFAULT 'pending' NOT NULL,
	`download_state` text DEFAULT 'downloaded' NOT NULL,
	`thumbnail_path` text
);
--> statement-breakpoint
CREATE TABLE `gallery_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`gallery_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `item_journeys` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`item_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`new_character_owner_id` text,
	`new_state` text NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`new_character_owner_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `items` (
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
CREATE TABLE `locations` (
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
CREATE TABLE `notes` (
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
CREATE TABLE `note_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`note_id` text NOT NULL,
	`relation_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `operation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`user_id` text NOT NULL,
	`operation_version` integer NOT NULL,
	`operation_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`is_synced` integer DEFAULT false NOT NULL,
	`server_operation_version` integer DEFAULT 0,
	`conflict_state` text
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
	`is_start` integer DEFAULT false NOT NULL,
	`is_finish` integer DEFAULT false NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` text PRIMARY KEY NOT NULL,
	`id_user` text NOT NULL,
	`user_name` text NOT NULL,
	`tag` text,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`last_sync_date` integer,
	`jwt_token` text,
	`refresh_token` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`genre` text,
	`language` text,
	`author` text,
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
CREATE TABLE `story_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`story_id` text NOT NULL,
	`server_id` text NOT NULL,
	`permission` text NOT NULL,
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
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`reason` text NOT NULL,
	`local_operation_type` text NOT NULL,
	`local_operation_ids` text NOT NULL,
	`local_values` text NOT NULL,
	`server_values` text,
	`client_version` integer,
	`server_version` integer,
	`message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`resolution` text,
	`detected_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE TABLE `tag_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`relation_id` text NOT NULL,
	`relation_type` text NOT NULL,
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
	`is_favorite` integer DEFAULT false NOT NULL,
	`extra_notes` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id_user` text PRIMARY KEY NOT NULL,
	`id_server` text NOT NULL,
	`display_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `world_rules` (
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
