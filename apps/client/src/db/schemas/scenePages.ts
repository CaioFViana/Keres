import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ScenePageFit } from '@keres/shared';

/**
 * A page (or frame) of a scene: an image - a Sketch or a Gallery medium - and the text that goes
 * with it. Ordered by `rank`. Neither image id is a foreign key: a page outlives its image and then
 * shows "media removed" until another is put in its place.
 */
export const scenePages = sqliteTable(
  'scene_pages',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    sceneId: text('scene_id').notNull(),
    rank: text('rank').notNull(),
    sketchId: text('sketch_id'),
    galleryId: text('gallery_id'),
    fit: text('fit').$type<ScenePageFit>().notNull().default('contain'),
    text: text('text'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  // Lookups only, never uniqueness: a synced table takes every row the server holds.
  (table) => [
    index('scene_page_story_idx').on(table.storyId),
    index('scene_page_scene_idx').on(table.sceneId),
  ],
);

export type ScenePageInsert = InferInsertModel<typeof scenePages>;
export type ScenePageSelect = InferSelectModel<typeof scenePages>;
