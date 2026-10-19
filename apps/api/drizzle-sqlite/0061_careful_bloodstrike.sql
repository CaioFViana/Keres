CREATE TABLE `age_verification_events` (
	`verifier_id` text NOT NULL,
	`event_id` text NOT NULL,
	`received_at` integer NOT NULL,
	`outcome` text NOT NULL,
	PRIMARY KEY(`verifier_id`, `event_id`)
);
--> statement-breakpoint
CREATE TABLE `age_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`verifier_id` text NOT NULL,
	`provider_reference` text NOT NULL,
	`status` text NOT NULL,
	`attempt` integer NOT NULL,
	`retry_of` text,
	`method` text,
	`identity_commitment` text,
	`rejection_reason` text,
	`action_json` text,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`decided_at` integer,
	`discarded_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `age_verifications_user_idx` ON `age_verifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `age_verifications_commitment_unique` ON `age_verifications` (`identity_commitment`);--> statement-breakpoint
ALTER TABLE `users` ADD `verification_status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `verified_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `verification_method` text;