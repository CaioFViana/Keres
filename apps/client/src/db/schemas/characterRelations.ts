import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const characterRelations = sqliteTable('character_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  character1Id: text('character1_id').notNull(),
  character2Id: text('character2_id').notNull(),
  relationType: text('relation_type').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type CharacterRelationInsert = InferInsertModel<typeof characterRelations>;
export type CharacterRelationSelect = InferSelectModel<typeof characterRelations>;
