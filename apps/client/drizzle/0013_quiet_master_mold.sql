PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`friend_username` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id_user`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id_user`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_friendships`("id", "server_id", "sender_id", "receiver_id", "friend_username", "status", "created_at", "updated_at", "version", "is_deleted", "deleted_at") SELECT "id", "server_id", "sender_id", "receiver_id", "friend_username", "status", "created_at", "updated_at", "version", "is_deleted", "deleted_at" FROM `friendships`;--> statement-breakpoint
DROP TABLE `friendships`;--> statement-breakpoint
ALTER TABLE `__new_friendships` RENAME TO `friendships`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `sender_receiver_unq` ON `friendships` (`sender_id`,`receiver_id`);