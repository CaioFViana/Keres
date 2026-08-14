import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const storySchemaFields = sqliteTable(
  'story_schema_fields',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    entityType: text('entity_type').notNull(),
    name: text('name').notNull(),
    key: text('key').notNull(),
    description: text('description'),
    type: text('type').notNull(),
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
    // Não filtrado por isDeleted - ver StorySchemaFieldService.deleteField, que muta `key` no
    // soft-delete pra liberar o slot, mesma razão do lado API (StorySchemaFieldSyncHandler).
    unique('story_entitytype_key_unq').on(table.storyId, table.entityType, table.key),
  ],
);

export type StorySchemaFieldInsert = InferInsertModel<typeof storySchemaFields>;
export type StorySchemaFieldSelect = InferSelectModel<typeof storySchemaFields>;
