import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const suggestions = sqliteTable(
  'suggestions',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    type: text('type').notNull(),
    value: text('value').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  // The autocomplete catalog holds each value once per type, as on the server. See migration 0015.
  (table) => [
    uniqueIndex('suggestion_type_value_unique')
      .on(table.storyId, table.type, table.value)
      .where(sql`${table.isDeleted} = 0`),
  ],
);

export type SuggestionSelect = typeof suggestions.$inferSelect;
export type SuggestionInsert = typeof suggestions.$inferInsert;
