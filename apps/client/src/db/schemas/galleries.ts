import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const galleries = sqliteTable('galleries', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  ownerId: text('owner_id').notNull(),
  imagePath: text('image_path').notNull(),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type GalleryInsert = InferInsertModel<typeof galleries>;
export type GallerySelect = InferSelectModel<typeof galleries>;
