-- Synced tables keep their indexes for lookups only: uniqueness is the server's, which answers a twin
-- with the `duplicate` reason; locally, refusing a row another device wrote dropped it for good.
DROP INDEX IF EXISTS `entity_field_unq`;--> statement-breakpoint
CREATE INDEX `entity_field_idx` ON `attribute_values` (`entity_id`,`field_id`);--> statement-breakpoint
DROP INDEX IF EXISTS `chapter_anchor_order_unique`;--> statement-breakpoint
CREATE INDEX `chapter_anchor_order_idx` ON `chapter_anchors` (`story_id`,`chapter_id`,`order`) WHERE "chapter_anchors"."is_deleted" = 0;--> statement-breakpoint
DROP INDEX IF EXISTS `character_relation_pair_unique`;--> statement-breakpoint
CREATE INDEX `character_relation_pair_idx` ON `character_relations` (`story_id`, MIN(`character1_id`, `character2_id`), MAX(`character1_id`, `character2_id`)) WHERE "character_relations"."is_deleted" = 0;--> statement-breakpoint
DROP INDEX IF EXISTS `favorite_story_entity_user_unq`;--> statement-breakpoint
CREATE INDEX `favorite_story_entity_user_idx` ON `favorites` (`story_id`,`entity_id`,`entity_type`,`user_id`);--> statement-breakpoint
DROP INDEX IF EXISTS `location_relation_pair_unique`;--> statement-breakpoint
CREATE INDEX `location_relation_pair_idx` ON `location_relations` (`story_id`, MIN(`location_a_id`, `location_b_id`), MAX(`location_a_id`, `location_b_id`), `relation_type`) WHERE "location_relations"."is_deleted" = 0;--> statement-breakpoint
DROP INDEX IF EXISTS `plot_scene_pair_unique`;--> statement-breakpoint
CREATE INDEX `plot_scene_pair_idx` ON `plot_scenes` (`plot_id`,`scene_id`) WHERE "plot_scenes"."is_deleted" = false;--> statement-breakpoint
DROP INDEX IF EXISTS `route_step_position_unique`;--> statement-breakpoint
CREATE INDEX `route_step_position_idx` ON `route_steps` (`route_id`,`position`) WHERE "route_steps"."is_deleted" = false;--> statement-breakpoint
DROP INDEX IF EXISTS `see_also_story_a_b_unq`;--> statement-breakpoint
CREATE INDEX `see_also_story_a_b_idx` ON `see_also_relations` (`story_id`,`entity_a_type`,`entity_a_id`,`entity_b_type`,`entity_b_id`);--> statement-breakpoint
DROP INDEX IF EXISTS `story_entitytype_key_unq`;--> statement-breakpoint
CREATE INDEX `story_entitytype_key_idx` ON `story_schema_fields` (`story_id`,`entity_type`,`key`);--> statement-breakpoint
DROP INDEX IF EXISTS `suggestion_type_value_unique`;--> statement-breakpoint
CREATE INDEX `suggestion_type_value_idx` ON `suggestions` (`story_id`,`type`,`value`) WHERE "suggestions"."is_deleted" = 0;--> statement-breakpoint
DROP INDEX IF EXISTS `tag_relation_target_unique`;--> statement-breakpoint
CREATE INDEX `tag_relation_target_idx` ON `tag_relations` (`story_id`,`tag_id`,`relation_id`,`relation_type`) WHERE "tag_relations"."is_deleted" = 0;--> statement-breakpoint
DROP INDEX IF EXISTS `tag_story_name_unique`;--> statement-breakpoint
CREATE INDEX `tag_story_name_idx` ON `tags` (`story_id`,`name`) WHERE "tags"."is_deleted" = 0;