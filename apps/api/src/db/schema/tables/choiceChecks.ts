import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { choiceCheckGroups } from './choiceCheckGroups';
import { items } from './items';
import { scenes } from './scenes';
import { stories } from './stories';

export const choiceChecks = pgTable('choice_checks', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  groupId: text('group_id')
    .notNull()
    .references(() => choiceCheckGroups.id),
  mode: text('mode', { enum: ['block', 'enable'] })
    .notNull()
    .default('block'),
  type: text('type', { enum: ['sceneCount', 'inventory', 'trigger'] }).notNull(),
  order: integer('order').notNull().default(0),
  // Usados apenas quando type = 'sceneCount'
  sceneId: text('scene_id').references(() => scenes.id),
  minVisits: integer('min_visits'),
  // Usados apenas quando type = 'inventory'
  itemId: text('item_id').references(() => items.id),
  itemPresence: text('item_presence', { enum: ['has', 'lacks'] }),
  // Usados apenas quando type = 'trigger'
  triggerName: text('trigger_name'),
  triggerState: text('trigger_state', { enum: ['set', 'unset'] }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const choiceChecksRelations = relations(choiceChecks, ({ one }) => ({
  story: one(stories, {
    fields: [choiceChecks.storyId],
    references: [stories.id],
  }),
  group: one(choiceCheckGroups, {
    fields: [choiceChecks.groupId],
    references: [choiceCheckGroups.id],
  }),
  scene: one(scenes, {
    fields: [choiceChecks.sceneId],
    references: [scenes.id],
  }),
  item: one(items, {
    fields: [choiceChecks.itemId],
    references: [items.id],
  }),
}));
