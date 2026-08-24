import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';

export const plots = table('plots', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  name: text('name').notNull(),
  details: text('details'),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const plotsRelations = relations(plots, ({ one }) => ({
  story: one(stories, { fields: [plots.storyId], references: [stories.id] }),
}));
