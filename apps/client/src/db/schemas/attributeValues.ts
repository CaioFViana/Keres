import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import type { StorySchemaEntityType } from '@keres/shared';

export const attributeValues = sqliteTable(
  'attribute_values',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    entityType: text('entity_type').$type<StorySchemaEntityType>().notNull(),
    // FK polimórfica (characters.id/locations.id/etc conforme entityType) - mesmo padrão de
    // NoteRelation.relationId/TagRelation.relationId, sem FK de banco de fato.
    entityId: text('entity_id').notNull(),
    fieldId: text('field_id').notNull(),
    value: text('value'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => [unique('entity_field_unq').on(table.entityId, table.fieldId)],
);

export type AttributeValueInsert = InferInsertModel<typeof attributeValues>;
export type AttributeValueSelect = InferSelectModel<typeof attributeValues>;
