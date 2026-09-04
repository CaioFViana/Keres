import { relations } from 'drizzle-orm';
import type { ChapterType } from '@keres/shared';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';
import { scenes } from './scenes';

export const chapters = table('chapters', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  name: text('name').notNull(),
  index: integer('index').notNull(),
  /**
   * Chapter or event. The reorder handler filters on this: each kind owns an independent 1..N
   * index space inside this table, because a chapter's index is narrative order and an event's is
   * not. Defaulted so existing rows need no data step.
   */
  type: text('type').$type<ChapterType>().notNull().default('chapter'),
  summary: text('summary'),
  isFavorite: boolean('is_favorite').notNull().default(false),
  extraNotes: text('extra_notes'),
  arcId: text('arc_id'),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  story: one(stories, {
    fields: [chapters.storyId],
    references: [stories.id],
  }),
  scenes: many(scenes),
}));
