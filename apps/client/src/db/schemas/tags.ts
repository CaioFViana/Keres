import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    name: text('name').notNull(),
    color: text('color'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false), // Added .default(false)
    extraNotes: text('extra_notes'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  // No two tags with the same name in one story, as on the server. See migration 0015.
  (table) => [
    uniqueIndex('tag_story_name_unique')
      .on(table.storyId, table.name)
      .where(sql`${table.isDeleted} = 0`),
  ],
);
export type TagInsert = InferInsertModel<typeof tags>;
export type TagSelect = InferSelectModel<typeof tags>;
