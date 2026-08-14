import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  characterOwnerId: text('character_owner_id'), // Nullable
  name: text('name').notNull(),
  category: text('category'), // Nullable
  description: text('description'), // Nullable
  initialState: text('initial_state'), // Nullable
  isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false).notNull(),
  extraNotes: text('extra_notes'), // Nullable
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type ItemInsert = InferInsertModel<typeof items>;
export type ItemSelect = InferSelectModel<typeof items>;
