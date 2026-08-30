import type { ScenePosition } from '@keres/shared';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * One stretch of story time a container occupies, anchored to the spine.
 *
 * The start is always a moment on a scene. The end is optional: when present, the stretch is that
 * interval; when absent, the container lasts as long as the scenes it contains. An offset places
 * what happened outside the reach of those scenes - "three hundred years before the first one" -
 * with a negative offset meaning *before*, the convention `Scene.gap` already uses.
 *
 * More than one row per container is how something discontinuous is said: a war that pauses and
 * resumes is two *closed* stretches. An open stretch cannot share a container with another.
 */
export const chapterAnchors = sqliteTable(
  'chapter_anchors',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id').notNull(),
    chapterId: text('chapter_id').notNull(),
    order: integer('order').notNull().default(1),

    startSceneId: text('start_scene_id').notNull(),
    startPosition: text('start_position').$type<ScenePosition>().notNull().default('start'),
    startOffset: integer('start_offset'),
    startOffsetUnit: text('start_offset_unit'),

    endSceneId: text('end_scene_id'),
    endPosition: text('end_position').$type<ScenePosition>(),
    endOffset: integer('end_offset'),
    endOffsetUnit: text('end_offset_unit'),

    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    version: integer('version').notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  },
  /*
   * One live stretch per position, so re-stating the same one replaces rather than piles up. The
   * order is what distinguishes a second stretch of the same container from a duplicate of the
   * first.
   */
  (table) => [
    uniqueIndex('chapter_anchor_order_unique')
      .on(table.storyId, table.chapterId, table.order)
      .where(sql`${table.isDeleted} = 0`),
  ],
);
export type ChapterAnchorInsert = InferInsertModel<typeof chapterAnchors>;
export type ChapterAnchorSelect = InferSelectModel<typeof chapterAnchors>;
