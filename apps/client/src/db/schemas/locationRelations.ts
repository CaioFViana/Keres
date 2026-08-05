import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const locationRelations = sqliteTable('location_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  locationAId: text('location_a_id').notNull(),
  locationBId: text('location_b_id').notNull(),
  relationType: text('relation_type').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type LocationRelationInsert = InferInsertModel<typeof locationRelations>;
export type LocationRelationSelect = InferSelectModel<typeof locationRelations>;
