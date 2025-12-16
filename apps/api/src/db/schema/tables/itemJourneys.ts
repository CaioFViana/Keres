import { boolean, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { stories } from './stories';
import { items } from './items';
import { scenes } from './scenes';
import { characters } from './characters';

export const itemJourneys = pgTable('item_journeys', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  itemId: text('item_id').notNull().references(() => items.id),
  sceneId: text('scene_id').notNull().references(() => scenes.id),
  newCharacterOwnerId: text('new_character_owner_id').references(() => characters.id),
  newState: text('new_state').notNull(),
  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    unq: unique('story_item_scene_unq').on(table.storyId, table.itemId, table.sceneId),
  };
});
