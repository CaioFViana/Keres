import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { characters } from './characters';
import { items } from './items';
import { scenes } from './scenes';
import { stories } from './stories';

export const itemJourneys = pgTable('item_journeys', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  itemId: text('item_id')
    .notNull()
    .references(() => items.id),
  sceneId: text('scene_id')
    .notNull()
    .references(() => scenes.id),
  newCharacterOwnerId: text('new_character_owner_id').references(() => characters.id),
  newState: text('new_state').notNull(),

  extraNotes: text('extra_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const itemJourneysRelations = relations(itemJourneys, ({ one }) => ({
  story: one(stories, {
    fields: [itemJourneys.storyId],
    references: [stories.id],
  }),
  item: one(items, {
    fields: [itemJourneys.itemId],
    references: [items.id],
  }),
  scene: one(scenes, {
    fields: [itemJourneys.sceneId],
    references: [scenes.id],
  }),
  newCharacterOwner: one(characters, {
    fields: [itemJourneys.newCharacterOwnerId],
    references: [characters.id],
  }),
}));
