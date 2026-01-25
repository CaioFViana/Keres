import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { scenes } from './scenes';
import { stories } from './stories';

export const choices = pgTable('choices', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  sceneId: text('scene_id').notNull().references(() => scenes.id),
  nextSceneId: text('next_scene_id').notNull().references(() => scenes.id),
  text: text('text').notNull(),
  isImplicit: boolean('is_implicit').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const choicesRelations = relations(choices, ({ one }) => ({
  story: one(stories, {
    fields: [choices.storyId],
    references: [stories.id],
  }),
  scene: one(scenes, {
    fields: [choices.sceneId],
    references: [scenes.id],
  }),
  nextScene: one(scenes, {
    fields: [choices.nextSceneId],
    references: [scenes.id],
  }),
}));
