import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const scenes = sqliteTable('scenes', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  chapterId: text('chapter_id').notNull(),
  locationId: text('location_id').notNull(), // Assuming locationId is always present
  name: text('name').notNull(),
  index: integer('index').notNull(),
  summary: text('summary'),
  gap: integer('gap'),
  gapType: text('gap_type'),
  duration: integer('duration'),
  durationType: text('duration_type'),
  isStart: integer('is_start', { mode: 'boolean' }).notNull().default(false),
  isFinish: integer('is_finish', { mode: 'boolean' }).notNull().default(false),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type SceneInsert = InferInsertModel<typeof scenes>;
export type SceneSelect = InferSelectModel<typeof scenes>;
