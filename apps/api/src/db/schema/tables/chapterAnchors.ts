import type { ScenePosition } from '@keres/shared';
import { boolean, integer, table, text, timestamp, timestampNow, unique } from '../columns';
import { chapters } from './chapters';
import { scenes } from './scenes';
import { stories } from './stories';

/**
 * One stretch of story time a container occupies, anchored to the spine.
 *
 * The start is always a moment on a scene. The end is optional: when present, the stretch is that
 * interval; when absent, the container lasts as long as the scenes it contains. A negative offset
 * means *before* the anchor, which is how something outside the reach of the story's scenes is
 * placed - "three hundred years before the first one" - and follows the convention `Scene.gap`
 * already uses.
 *
 * More than one row per container says it pauses and resumes, and those stretches must be closed.
 */
export const chapterAnchors = table(
  'chapter_anchors',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    chapterId: text('chapter_id')
      .notNull()
      .references(() => chapters.id),
    order: integer('order').notNull().default(1),

    startSceneId: text('start_scene_id')
      .notNull()
      .references(() => scenes.id),
    startPosition: text('start_position').$type<ScenePosition>().notNull().default('start'),
    startOffset: integer('start_offset'),
    startOffsetUnit: text('start_offset_unit'),

    endSceneId: text('end_scene_id').references(() => scenes.id),
    endPosition: text('end_position').$type<ScenePosition>(),
    endOffset: integer('end_offset'),
    endOffsetUnit: text('end_offset_unit'),

    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => {
    return {
      unq: unique('story_chapter_anchor_order_unq').on(table.storyId, table.chapterId, table.order),
    };
  },
);
