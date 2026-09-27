ALTER TABLE "attribute_values" DROP CONSTRAINT "entity_field_unq";--> statement-breakpoint
ALTER TABLE "chapter_anchors" DROP CONSTRAINT "story_chapter_anchor_order_unq";--> statement-breakpoint
ALTER TABLE "character_relations" DROP CONSTRAINT "story_char1_char2_unq";--> statement-breakpoint
ALTER TABLE "favorites" DROP CONSTRAINT "favorite_story_entity_user_unq";--> statement-breakpoint
ALTER TABLE "location_relations" DROP CONSTRAINT "story_loca_locb_type_unq";--> statement-breakpoint
ALTER TABLE "see_also_relations" DROP CONSTRAINT "see_also_story_a_b_unq";--> statement-breakpoint
ALTER TABLE "story_schema_fields" DROP CONSTRAINT "story_entitytype_key_unq";--> statement-breakpoint
ALTER TABLE "suggestions" DROP CONSTRAINT "story_suggestion_type_value_unq";--> statement-breakpoint
ALTER TABLE "tag_relations" DROP CONSTRAINT "story_tag_relation_unq";--> statement-breakpoint
ALTER TABLE "tags" DROP CONSTRAINT "story_name_unq";--> statement-breakpoint
DROP INDEX "route_step_position_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "entity_field_unq" ON "attribute_values" USING btree ("entity_id","field_id") WHERE "attribute_values"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "story_char1_char2_unq" ON "character_relations" USING btree ("story_id","character1_id","character2_id") WHERE "character_relations"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_story_entity_user_unq" ON "favorites" USING btree ("story_id","entity_id","entity_type","user_id") WHERE "favorites"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "story_loca_locb_type_unq" ON "location_relations" USING btree ("story_id","location_a_id","location_b_id","relation_type") WHERE "location_relations"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "see_also_story_a_b_unq" ON "see_also_relations" USING btree ("story_id","entity_a_type","entity_a_id","entity_b_type","entity_b_id") WHERE "see_also_relations"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "story_entitytype_key_unq" ON "story_schema_fields" USING btree ("story_id","entity_type","key") WHERE "story_schema_fields"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "story_suggestion_type_value_unq" ON "suggestions" USING btree ("story_id","type","value") WHERE "suggestions"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "story_tag_relation_unq" ON "tag_relations" USING btree ("story_id","tag_id","relation_id","relation_type") WHERE "tag_relations"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "story_name_unq" ON "tags" USING btree ("story_id","name") WHERE "tags"."is_deleted" = false;