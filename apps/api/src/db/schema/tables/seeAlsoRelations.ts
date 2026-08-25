import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow, unique } from '../columns';
import { stories } from './stories';
import type { SeeAlsoEntityType } from '@keres/shared';

export const seeAlsoRelations = table(
  'see_also_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    // Both sides are polymorphic (Character/Location/Chapter/Scene/Item/ItemJourney/WorldRule/Choice) -
    // no database FK, validated in SeeAlsoRelationSyncHandler.
    entityAType: text('entity_a_type').$type<SeeAlsoEntityType>().notNull(),
    entityAId: text('entity_a_id').notNull(),
    entityBType: text('entity_b_type').$type<SeeAlsoEntityType>().notNull(),
    entityBId: text('entity_b_id').notNull(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    // It only protects against duplicates if A/B are always canonicalised (sorted) before the insert -
    // see SeeAlsoRelationSyncHandler/SeeAlsoRelationService.
    unq: unique('see_also_story_a_b_unq').on(
      table.storyId,
      table.entityAType,
      table.entityAId,
      table.entityBType,
      table.entityBId,
    ),
  }),
);

export const seeAlsoRelationsRelations = relations(seeAlsoRelations, ({ one }) => ({
  story: one(stories, { fields: [seeAlsoRelations.storyId], references: [stories.id] }),
}));
