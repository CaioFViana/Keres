import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { ChapterType } from '@keres/shared';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const chapters = sqliteTable('chapters', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  name: text('name').notNull(),
  index: integer('index').notNull(),
  /**
   * Chapter or event. A chapter's index is the story's narrative order; an event's is only the
   * order the writer arranged the list in - the two keep separate 1..N spaces. Defaulted so every
   * row written before this column existed becomes a chapter with no data step.
   */
  type: text('type').$type<ChapterType>().notNull().default('chapter'),
  summary: text('summary'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type ChapterInsert = InferInsertModel<typeof chapters>;
export type ChapterSelect = InferSelectModel<typeof chapters>;
