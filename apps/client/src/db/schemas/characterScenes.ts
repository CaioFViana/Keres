import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const characterScenes = sqliteTable('character_scenes', {
  id: text('id').primaryKey(), // Primary key for characterScenes
  characterId: text('character_id').notNull(),
  storyId: text('story_id').notNull(),
  sceneId: text('scene_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type CharacterSceneInsert = InferInsertModel<typeof characterScenes>;
export type CharacterSceneSelect = InferSelectModel<typeof characterScenes>;
