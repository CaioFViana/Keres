CREATE TABLE `routes` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`name` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `route_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`route_id` text NOT NULL,
	`position` integer NOT NULL,
	`scene_id` text NOT NULL,
	`selected_choice_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`selected_choice_id`) REFERENCES `choices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `route_step_story_idx` ON `route_steps` (`story_id`);--> statement-breakpoint
CREATE INDEX `route_step_route_idx` ON `route_steps` (`route_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `route_step_position_unique` ON `route_steps` (`route_id`,`position`) WHERE "route_steps"."is_deleted" = false;