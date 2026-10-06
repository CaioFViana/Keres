import type { SketchContentType } from '@keres/shared';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A drawing board page. `content` is `mode: 'json'` for the same reason a
 * board's is: the operation log serialises the row, and a string column would arrive
 * double-encoded at the server. `coverGalleryId` links the gallery snapshot exported
 * from the canvas; the drawing itself never references gallery rows.
 */
export const sketches = sqliteTable('sketches', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  content: text('content', { mode: 'json' }).$type<SketchContentType>().notNull(),
  coverGalleryId: text('cover_gallery_id'),
  coverSourceHash: text('cover_source_hash'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type SketchInsert = InferInsertModel<typeof sketches>;
export type SketchSelect = InferSelectModel<typeof sketches>;
