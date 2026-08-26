import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { items } from './items';

export const effects = sqliteTable('effects', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  entityType: text('entity_type', { enum: ['Scene', 'Choice'] }).notNull(),
  entityId: text('entity_id').notNull(),
  effectType: text('effect_type', {
    enum: ['itemGrant', 'itemTake', 'triggerSet', 'triggerUnset'],
  }).notNull(),
  // Usado quando effectType = 'itemGrant' | 'itemTake'
  itemId: text('item_id').references(() => items.id),
  // Usado quando effectType = 'triggerSet' | 'triggerUnset'
  triggerName: text('trigger_name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type EffectInsert = InferInsertModel<typeof effects>;
export type EffectSelect = InferSelectModel<typeof effects>;
