import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const suggestions = sqliteTable('suggestions', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  type: text('type').notNull(),
  value: text('value').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type SuggestionSelect = typeof suggestions.$inferSelect;
export type SuggestionInsert = typeof suggestions.$inferInsert;