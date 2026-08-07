import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const choices = sqliteTable('choices', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  sceneId: text('scene_id').notNull(),
  nextSceneId: text('next_scene_id').notNull(),
  text: text('text').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});
export type ChoiceInsert = InferInsertModel<typeof choices>;
export type ChoiceSelect = InferSelectModel<typeof choices>;
