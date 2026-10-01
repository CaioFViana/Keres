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
  /** Place among the containers of its kind (see rules/rank.ts); the index is derived from it. */
  rank: text('rank').notNull().default(''),
  /**
   * Chapter or event: each kind owns an independent 1..N index space inside this table (derived
   * from `rank`), because a chapter's index is narrative order and an event's is not.
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
