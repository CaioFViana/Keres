ALTER TABLE `packs` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
CREATE INDEX `pack_visibility_idx` ON `packs` (`visibility`);