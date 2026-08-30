import type { BoardContentType } from '@keres/shared';
import { relations } from 'drizzle-orm';
import { boolean, integer, json, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';

/**
 * A named spatial sketch. See `BoardSchemas.ts` for why the drawing is one JSON document.
 */
export const boards = table('boards', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  name: text('name').notNull(),
  description: text('description'),
  content: json('content').$type<BoardContentType>().notNull(),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const boardsRelations = relations(boards, ({ one }) => ({
  story: one(stories, {
    fields: [boards.storyId],
    references: [stories.id],
  }),
}));
