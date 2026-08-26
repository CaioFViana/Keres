import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { items } from './items';
import { stories } from './stories';

export const effects = table('effects', {
  id: text('id').primaryKey(),
  storyId: text('story_id')
    .notNull()
    .references(() => stories.id),
  // Polymorphic (Scene/Choice) - no database FK, the same pattern as comments.entityType/entityId.
  entityType: text('entity_type', { enum: ['Scene', 'Choice'] }).notNull(),
  entityId: text('entity_id').notNull(),
  effectType: text('effect_type', {
    enum: ['itemGrant', 'itemTake', 'triggerSet', 'triggerUnset'],
  }).notNull(),
  // Usado quando effectType = 'itemGrant' | 'itemTake'
  itemId: text('item_id').references(() => items.id),
  // Usado quando effectType = 'triggerSet' | 'triggerUnset'
  triggerName: text('trigger_name'),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
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
