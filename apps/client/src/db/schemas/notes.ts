import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  galleryId: text('gallery_id'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type NoteInsert = InferInsertModel<typeof notes>;
export type NoteSelect = InferSelectModel<typeof notes>;
