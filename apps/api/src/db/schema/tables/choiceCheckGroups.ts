import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { choices } from './choices';
import { stories } from './stories';

export const choiceCheckGroups = table('choice_check_groups', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  choiceId: text('choice_id')
    .notNull()
    .references(() => choices.id),
  combinator: text('combinator', { enum: ['AND', 'OR'] })
    .notNull()
    .default('AND'),
  order: integer('order').notNull().default(0),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
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
