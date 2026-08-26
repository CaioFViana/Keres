import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { choiceCheckGroups } from './choiceCheckGroups';
import { items } from './items';
import { scenes } from './scenes';

export const choiceChecks = sqliteTable('choice_checks', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  groupId: text('group_id')
    .notNull()
    .references(() => choiceCheckGroups.id),
  mode: text('mode', { enum: ['block', 'enable'] }).notNull(),
  type: text('type', { enum: ['sceneCount', 'inventory', 'trigger'] }).notNull(),
  order: integer('order').notNull(),
  // Used only when type = 'sceneCount'
  sceneId: text('scene_id').references(() => scenes.id),
  minVisits: integer('min_visits'),
  // Used only when type = 'inventory'
  itemId: text('item_id').references(() => items.id),
  itemPresence: text('item_presence', { enum: ['has', 'lacks'] }),
  // Used only when type = 'trigger'
  triggerName: text('trigger_name'),
  triggerState: text('trigger_state', { enum: ['set', 'unset'] }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type ChoiceCheckInsert = InferInsertModel<typeof choiceChecks>;
export type ChoiceCheckSelect = InferSelectModel<typeof choiceChecks>;
