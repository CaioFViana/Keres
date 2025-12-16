import { boolean, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { characters } from './characters';
import { stories } from './stories';

export const characterRelations = pgTable('character_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  character1Id: text('character1_id').notNull().references(() => characters.id),
  character2Id: text('character2_id').notNull().references(() => characters.id),
  relationType: text('relation_type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    unq: unique('story_char1_char2_unq').on(table.storyId, table.character1Id, table.character2Id),
  };
});
