ALTER TABLE `tiers` ADD `max_publications_per_story` integer;--> statement-breakpoint
UPDATE `tiers` SET `max_publications_per_story` = 5;