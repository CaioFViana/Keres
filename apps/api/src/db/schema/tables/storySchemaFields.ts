import { relations, sql } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow, uniqueIndex } from '../columns';
import { stories } from './stories';
import type { StorySchemaEntityType } from '@keres/shared';

export const storySchemaFields = table(
  'story_schema_fields',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    entityType: text('entity_type').$type<StorySchemaEntityType>().notNull(),
    name: text('name').notNull(),
    key: text('key').notNull(),
    description: text('description'),
    type: text('type').notNull(),
    targetEntityType: text('target_entity_type'),
    isRequired: boolean('is_required').notNull().default(false),
    defaultValue: text('default_value'),
    order: integer('order').notNull().default(0),
    /** Place among its entity type's fields (see rules/rank.ts); the order is derived from it. */
    rank: text('rank').notNull().default(''),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      // Live fields only: a deleted field never keeps another from taking its key (its delete also
      // renames the key, for rows written before this index was partial).
      unq: uniqueIndex('story_entitytype_key_unq')
        .on(table.storyId, table.entityType, table.key)
        .where(sql`${table.isDeleted} = false`),
    };
  },
);

export const storySchemaFieldsRelations = relations(storySchemaFields, ({ one }) => ({
  story: one(stories, {
    fields: [storySchemaFields.storyId],
    references: [stories.id],
  }),
}));
