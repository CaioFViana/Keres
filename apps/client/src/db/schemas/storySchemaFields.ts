import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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
    /** Place among its entity type's fields (see rules/rank.ts); a trigger derives the order. */
    rank: text('rank').notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  // Lookups only, never uniqueness: a synced table must take every row the server holds. Two
  // devices can write the same thing offline; the push folds the twin (the `duplicate` reason).
  (table) => [index('story_entitytype_key_idx').on(table.storyId, table.entityType, table.key)],
);

export type StorySchemaFieldInsert = InferInsertModel<typeof storySchemaFields>;
export type StorySchemaFieldSelect = InferSelectModel<typeof storySchemaFields>;
