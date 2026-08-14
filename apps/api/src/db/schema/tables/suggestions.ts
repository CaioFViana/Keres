import { boolean, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { stories } from './stories';

export const suggestions = pgTable(
  'suggestions',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    type: text('type').notNull(),
    value: text('value').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      unq: unique('story_suggestion_type_value_unq').on(table.storyId, table.type, table.value),
    };
  },
);
