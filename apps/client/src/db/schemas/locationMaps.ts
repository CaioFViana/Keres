import type { LocationMapContentType } from '@keres/shared';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A named drawing over gallery images, with location points on top. `content` is `mode: 'json'`
 * for the same reason a board's is: the operation log serialises the row, and a string column
 * would arrive double-encoded at the server.
 */
export const locationMaps = sqliteTable('location_maps', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  content: text('content', { mode: 'json' }).$type<LocationMapContentType>().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type LocationMapInsert = InferInsertModel<typeof locationMaps>;
export type LocationMapSelect = InferSelectModel<typeof locationMaps>;