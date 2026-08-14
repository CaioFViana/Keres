import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { stories } from './stories';

export const storySchemaFields = pgTable(
  'story_schema_fields',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    entityType: text('entity_type').notNull(),
    name: text('name').notNull(),
    key: text('key').notNull(),
    description: text('description'),
    type: text('type').notNull(),
    isRequired: boolean('is_required').notNull().default(false),
    defaultValue: text('default_value'),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      // Não filtrado por isDeleted - ver StorySchemaFieldSyncHandler.delete(), que muta `key`
      // no soft-delete pra liberar o slot em vez de depender de um índice parcial.
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
