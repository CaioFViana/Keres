CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`category` text NOT NULL,
	`action` text NOT NULL,
	`outcome` text NOT NULL,
	`actor_user_id` text,
	`actor_username` text,
	`subject_user_id` text,
	`target_type` text,
	`target_id` text,
	`ip` text,
	`user_agent` text,
	`meta` text
);
--> statement-breakpoint
CREATE INDEX `audit_events_created_idx` ON `audit_events` ("created_at" desc);--> statement-breakpoint
CREATE INDEX `audit_events_category_idx` ON `audit_events` (`category`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `audit_events_action_idx` ON `audit_events` (`action`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `audit_events_actor_idx` ON `audit_events` (`actor_user_id`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `audit_events_subject_idx` ON `audit_events` (`subject_user_id`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `audit_events_outcome_idx` ON `audit_events` (`outcome`,"created_at" desc);