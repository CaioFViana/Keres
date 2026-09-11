import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { stories } from './stories';

export const storyArcs = table('story_arcs', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  title: text('title').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  color: text('color'),
  icon: text('icon'),
  themeOverride: text('theme_override'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const storyArcsRelations = relations(storyArcs, ({ one }) => ({
  story: one(stories, { fields: [storyArcs.storyId], references: [stories.id] }),
}));
