CREATE TABLE `contact_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`contact_email` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `registration_settings` ADD `currency` text DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE `showcase_settings` ADD `is_landing_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tiers` ADD `price_monthly_cents` integer;--> statement-breakpoint
ALTER TABLE `tiers` ADD `price_yearly_cents` integer;--> statement-breakpoint
ALTER TABLE `tiers` ADD `is_public_for_sale` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tiers` ADD `sort_order` integer DEFAULT 0 NOT NULL;