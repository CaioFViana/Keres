import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { characters } from './characters';
import { stories } from './stories';
import { scenes } from './scenes';

export const characterScenes = pgTable('character_scenes', {
  id: text('id').primaryKey(),
  characterId: text('character_id')
    .notNull()
    .references(() => characters.id),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  sceneId: text('scene_id')
    .notNull()
    .references(() => scenes.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});
