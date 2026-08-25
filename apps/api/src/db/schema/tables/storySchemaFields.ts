import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow, unique } from '../columns';
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
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      // Not filtered by isDeleted - see StorySchemaFieldSyncHandler.delete(), which mutates `key` on the
      // soft delete to free the slot instead of relying on a partial index.
      unq: unique('story_entitytype_key_unq').on(table.storyId, table.entityType, table.key),
    };
  },
);

export const storySchemaFieldsRelations = relations(storySchemaFields, ({ one }) => ({
  story: one(stories, {
    fields: [storySchemaFields.storyId],
    references: [stories.id],
  }),
}));
