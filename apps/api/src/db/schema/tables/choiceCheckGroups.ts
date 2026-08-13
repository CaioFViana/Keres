import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { choices } from './choices';
import { stories } from './stories';

export const choiceCheckGroups = pgTable('choice_check_groups', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  choiceId: text('choice_id').notNull().references(() => choices.id),
  combinator: text('combinator', { enum: ['AND', 'OR'] }).notNull().default('AND'),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const choiceCheckGroupsRelations = relations(choiceCheckGroups, ({ one }) => ({
  story: one(stories, {
    fields: [choiceCheckGroups.storyId],
    references: [stories.id],
  }),
  choice: one(choices, {
    fields: [choiceCheckGroups.choiceId],
    references: [choices.id],
  }),
}));
