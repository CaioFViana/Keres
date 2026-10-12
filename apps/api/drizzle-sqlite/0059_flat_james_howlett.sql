CREATE TABLE `terms_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`version` integer NOT NULL,
	`text_hash` text NOT NULL,
	`method` text NOT NULL,
	`accepted_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `terms_acceptances_user_idx` ON `terms_acceptances` (`user_id`,`kind`);