import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import type { AttributeType, StorySchemaEntityType } from '@keres/shared';

export const storySchemaFields = sqliteTable(
  'story_schema_fields',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    entityType: text('entity_type').$type<StorySchemaEntityType>().notNull(),
    name: text('name').notNull(),
    key: text('key').notNull(),
    description: text('description'),
    // Typed from the shared union, like `entityType` above: SQLite has no ENUM, and without
    // this the column reads back as a bare `string` and every consumer has to re-narrow it.
    type: text('type').$type<AttributeType>().notNull(),
    targetEntityType: text('target_entity_type').$type<StorySchemaEntityType>(),
    isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(false),
    defaultValue: text('default_value'),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  (table) => [
    // Not filtered by isDeleted - see StorySchemaFieldService.deleteField, which mutates `key` on the
    // soft-delete to free the slot, the same reason as on the API side (StorySchemaFieldSyncHandler).
    unique('story_entitytype_key_unq').on(table.storyId, table.entityType, table.key),
  ],
);

export type StorySchemaFieldInsert = InferInsertModel<typeof storySchemaFields>;
export type StorySchemaFieldSelect = InferSelectModel<typeof storySchemaFields>;
