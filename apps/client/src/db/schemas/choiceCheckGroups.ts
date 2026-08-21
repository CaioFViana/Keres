import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { choices } from './choices';

export const choiceCheckGroups = sqliteTable('choice_check_groups', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  choiceId: text('choice_id')
    .notNull()
    .references(() => choices.id),
  combinator: text('combinator', { enum: ['AND', 'OR'] }).notNull(),
  order: integer('order').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type ChoiceCheckGroupInsert = InferInsertModel<typeof choiceCheckGroups>;
export type ChoiceCheckGroupSelect = InferSelectModel<typeof choiceCheckGroups>;
