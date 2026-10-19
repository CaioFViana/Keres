CREATE TABLE `scene_music` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`rank` text NOT NULL,
	`song_id` text,
	`gallery_id` text,
	`role` text DEFAULT 'score' NOT NULL,
	`cue` text,
	`sections` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer NOT NULL,
	`is_deleted` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `scene_music_story_idx` ON `scene_music` (`story_id`);--> statement-breakpoint
CREATE INDEX `scene_music_scene_idx` ON `scene_music` (`scene_id`);