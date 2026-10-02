CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`sender_id` text,
	`recipient_id` text,
	`sent_by_admin_id` text,
	`subject` text,
	`body` text NOT NULL,
	`contact_email` text,
	`created_at` integer NOT NULL,
	`sender_deleted_at` integer,
	`recipient_deleted_at` integer,
	`admin_read_at` integer,
	`admin_archived_at` integer,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sent_by_admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `messages_recipient_idx` ON `messages` (`recipient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_sender_idx` ON `messages` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `messages_channel_idx` ON `messages` (`channel`,`created_at`);--> statement-breakpoint
CREATE TABLE `message_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `message_log_user_idx` ON `message_log` (`user_id`,`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `message_log_created_idx` ON `message_log` (`created_at`);--> statement-breakpoint
ALTER TABLE `tiers` ADD `max_messages_per_day` integer;