import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { characters } from './characters';
import { items } from './items';
import { scenes } from './scenes';

export const itemJourneys = sqliteTable('item_journeys', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  itemId: text('item_id')
    .notNull()
    .references(() => items.id),
  sceneId: text('scene_id')
    .notNull()
    .references(() => scenes.id),
  newCharacterOwnerId: text('new_character_owner_id').references(() => characters.id),
  newState: text('new_state').notNull(),

  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type ItemJourneyInsert = InferInsertModel<typeof itemJourneys>;
export type ItemJourneySelect = InferSelectModel<typeof itemJourneys>;
