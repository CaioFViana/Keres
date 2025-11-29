import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const itemJourneys = sqliteTable('item_journeys', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  itemId: text('item_id').notNull(),
  sceneId: text('scene_id').notNull(),
  newCharacterOwnerId: text('new_character_owner_id'), // Nullable
  newState: text('new_state').notNull(),
  extraNotes: text('extra_notes'), // Nullable
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type ItemJourneyInsert = InferInsertModel<typeof itemJourneys>;
export type ItemJourneySelect = InferSelectModel<typeof itemJourneys>;
