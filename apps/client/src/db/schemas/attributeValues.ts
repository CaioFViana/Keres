import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { StorySchemaEntityType } from '@keres/shared';

export const attributeValues = sqliteTable(
  'attribute_values',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    entityType: text('entity_type').$type<StorySchemaEntityType>().notNull(),
    // A polymorphic FK (characters.id/locations.id/etc according to entityType) - the same pattern as
    // NoteRelation.relationId/TagRelation.relationId, without an actual database FK.
    entityId: text('entity_id').notNull(),
    fieldId: text('field_id').notNull(),
    value: text('value'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  // Lookups only, never uniqueness: a synced table must take every row the server holds. Two
  // devices can write the same thing offline; the push folds the twin (the `duplicate` reason).
  (table) => [index('entity_field_idx').on(table.entityId, table.fieldId)],
);

export type AttributeValueInsert = InferInsertModel<typeof attributeValues>;
export type AttributeValueSelect = InferSelectModel<typeof attributeValues>;
