DROP INDEX `story_chapter_anchor_order_unq`;--> statement-breakpoint
DROP INDEX `route_step_position_unique`;--> statement-breakpoint
DROP INDEX `entity_field_unq`;--> statement-breakpoint
CREATE UNIQUE INDEX `entity_field_unq` ON `attribute_values` (`entity_id`,`field_id`) WHERE "attribute_values"."is_deleted" = false;--> statement-breakpoint
DROP INDEX `story_char1_char2_unq`;--> statement-breakpoint
CREATE UNIQUE INDEX `story_char1_char2_unq` ON `character_relations` (`story_id`,`character1_id`,`character2_id`) WHERE "character_relations"."is_deleted" = false;--> statement-breakpoint
DROP INDEX `favorite_story_entity_user_unq`;--> statement-breakpoint
CREATE UNIQUE INDEX `favorite_story_entity_user_unq` ON `favorites` (`story_id`,`entity_id`,`entity_type`,`user_id`) WHERE "favorites"."is_deleted" = false;--> statement-breakpoint
DROP INDEX `story_loca_locb_type_unq`;--> statement-breakpoint
CREATE UNIQUE INDEX `story_loca_locb_type_unq` ON `location_relations` (`story_id`,`location_a_id`,`location_b_id`,`relation_type`) WHERE "location_relations"."is_deleted" = false;--> statement-breakpoint
DROP INDEX `see_also_story_a_b_unq`;--> statement-breakpoint
CREATE UNIQUE INDEX `see_also_story_a_b_unq` ON `see_also_relations` (`story_id`,`entity_a_type`,`entity_a_id`,`entity_b_type`,`entity_b_id`) WHERE "see_also_relations"."is_deleted" = false;--> statement-breakpoint
DROP INDEX `story_entitytype_key_unq`;--> statement-breakpoint
CREATE UNIQUE INDEX `story_entitytype_key_unq` ON `story_schema_fields` (`story_id`,`entity_type`,`key`) WHERE "story_schema_fields"."is_deleted" = false;--> statement-breakpoint
DROP INDEX `story_suggestion_type_value_unq`;--> statement-breakpoint
CREATE UNIQUE INDEX `story_suggestion_type_value_unq` ON `suggestions` (`story_id`,`type`,`value`) WHERE "suggestions"."is_deleted" = false;--> statement-breakpoint
DROP INDEX `story_tag_relation_unq`;--> statement-breakpoint
CREATE UNIQUE INDEX `story_tag_relation_unq` ON `tag_relations` (`story_id`,`tag_id`,`relation_id`,`relation_type`) WHERE "tag_relations"."is_deleted" = false;--> statement-breakpoint
DROP INDEX `story_name_unq`;--> statement-breakpoint
CREATE UNIQUE INDEX `story_name_unq` ON `tags` (`story_id`,`name`) WHERE "tags"."is_deleted" = false;