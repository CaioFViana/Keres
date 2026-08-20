import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { scenes } from './scenes';
import { stories } from './stories';

export const choices = table('choices', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  sceneId: text('scene_id')
    .notNull()
    .references(() => scenes.id),
  nextSceneId: text('next_scene_id')
    .notNull()
    .references(() => scenes.id),
  text: text('text').notNull(),
  notes: text('notes'),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
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
