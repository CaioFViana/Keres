import { boolean, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { locations } from './locations';
import { stories } from './stories';

export const locationRelations = pgTable('location_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  locationAId: text('location_a_id').notNull().references(() => locations.id),
  locationBId: text('location_b_id').notNull().references(() => locations.id),
  relationType: text('relation_type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    unq: unique('story_loca_locb_type_unq').on(table.storyId, table.locationAId, table.locationBId, table.relationType),
  };
});
