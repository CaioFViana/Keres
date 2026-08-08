import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const favorites = sqliteTable('favorites', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  userId: text('user_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (table) => [
  unique('favorite_story_entity_user_unq').on(
    table.storyId,
    table.entityId,
    table.entityType,
    table.userId,
  ),
]);

export type FavoriteInsert = InferInsertModel<typeof favorites>;
export type FavoriteSelect = InferSelectModel<typeof favorites>;
