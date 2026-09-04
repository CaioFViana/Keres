import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const storyArcs = sqliteTable('story_arcs', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull(),
  color: text('color'),
  icon: text('icon'),
  themeOverride: text('theme_override'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type StoryArcInsert = InferInsertModel<typeof storyArcs>;
export type StoryArcSelect = InferSelectModel<typeof storyArcs>;
