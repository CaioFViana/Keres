import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tagRelations = sqliteTable('tag_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  tagId: text('tag_id').notNull(),
  relationId: text('relation_id').notNull(), // This is relationId in TagRelationSchema
  relationType: text('relation_type').notNull(), // This is relationType in TagRelationSchema
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type TagRelationInsert = InferInsertModel<typeof tagRelations>;
export type TagRelationSelect = InferSelectModel<typeof tagRelations>;
