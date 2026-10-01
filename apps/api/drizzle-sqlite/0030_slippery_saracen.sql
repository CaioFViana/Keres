ALTER TABLE `media_blobs` ADD `unreferenced_since` integer;--> statement-breakpoint
CREATE INDEX `media_blobs_unreferenced_since_idx` ON `media_blobs` (`unreferenced_since`);