CREATE TABLE `songs` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`lyrics` text DEFAULT '' NOT NULL,
	`lyrics_translation` text,
	`melody` text,
	`key` text,
	`tempo` integer,
	`meter` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `song_story_idx` ON `songs` (`story_id`);