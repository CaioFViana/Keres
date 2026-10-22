ALTER TABLE `users` ADD `profile_biography` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_links` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_theme` text;