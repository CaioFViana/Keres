import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { items } from './items';
import { stories } from './stories';

export const effects = pgTable('effects', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id),
  // Polimórfico (Scene/Choice) - sem FK de banco, mesmo padrão de comments.entityType/entityId.
  entityType: text('entity_type', { enum: ['Scene', 'Choice'] }).notNull(),
  entityId: text('entity_id').notNull(),
  effectType: text('effect_type', { enum: ['itemGrant', 'itemTake', 'triggerSet', 'triggerUnset'] }).notNull(),
  // Usado quando effectType = 'itemGrant' | 'itemTake'
  itemId: text('item_id').references(() => items.id),
  // Usado quando effectType = 'triggerSet' | 'triggerUnset'
  triggerName: text('trigger_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const effectsRelations = relations(effects, ({ one }) => ({
  story: one(stories, {
    fields: [effects.storyId],
    references: [stories.id],
  }),
  item: one(items, {
    fields: [effects.itemId],
    references: [items.id],
  }),
}));
