import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const noteRelations = sqliteTable('note_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  noteId: text('note_id').notNull(),
  relationId: text('relation_id').notNull(),
  relationType: text('relation_type').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type NoteRelationInsert = InferInsertModel<typeof noteRelations>;
export type NoteRelationSelect = InferSelectModel<typeof noteRelations>;
