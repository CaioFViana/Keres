import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { TagSelect } from './tags'; // Import TagSelect

export const worldRules = sqliteTable('world_rules', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type WorldRuleInsert = InferInsertModel<typeof worldRules>;
export type WorldRuleSelect = InferSelectModel<typeof worldRules>;

export type WorldRuleWithTags = WorldRuleSelect & {
  tags: TagSelect[];
};
