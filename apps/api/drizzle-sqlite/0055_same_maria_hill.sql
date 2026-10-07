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
	`version` integer DEFAULT 1 NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scene_music_story_idx` ON `scene_music` (`story_id`);--> statement-breakpoint
CREATE INDEX `scene_music_scene_idx` ON `scene_music` (`scene_id`);