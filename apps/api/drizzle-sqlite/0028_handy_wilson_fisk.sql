ALTER TABLE `showcase_settings` ADD `site_name` text DEFAULT 'Keres' NOT NULL;--> statement-breakpoint
ALTER TABLE `showcase_settings` ADD `site_palette` text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE `showcase_settings` ADD `logo_content_type` text;--> statement-breakpoint
ALTER TABLE `showcase_settings` ADD `logo_updated_at` integer;