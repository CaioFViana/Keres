CREATE TABLE `evidence_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`subject_user_id` text,
	`report_message_ids` text NOT NULL,
	`created_by` text,
	`note` text,
	`snapshot` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evidence_holds_target_idx` ON `evidence_holds` (`target_kind`,`target_id`);--> statement-breakpoint
CREATE INDEX `evidence_holds_expires_idx` ON `evidence_holds` (`expires_at`);