import { boolean, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { stories } from './stories';
import { tags } from './tags';

export const tagRelations = pgTable('tag_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  tagId: text('tag_id').notNull().references(() => tags.id),
  relationId: text('relation_id').notNull(),
  relationType: text('relation_type').notNull(), // e.g., 'Character', 'Location', 'Scene'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    unq: unique('story_tag_relation_unq').on(table.storyId, table.tagId, table.relationId, table.relationType),
  };
});
