import type { ScenePosition } from '@keres/shared';
import { boolean, integer, table, text, timestamp, timestampNow, unique } from '../columns';
import { chapters } from './chapters';
import { scenes } from './scenes';
import { stories } from './stories';

/**
 * One stretch of story time a container occupies, anchored to the scenes that bound it.
 *
 * The story timeline already measures every scene, so a container pinned to two of them has an exact
 * position without anybody inventing a coordinate. A negative offset means *before* the anchor,
 * which is how something outside the reach of the story's scenes is placed - "three hundred years
 * before the first one" - and follows the convention `Scene.gap` already uses.
 *
 * More than one row per container says it pauses and resumes.
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

    endSceneId: text('end_scene_id')
      .notNull()
      .references(() => scenes.id),
    endPosition: text('end_position').$type<ScenePosition>().notNull().default('end'),
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
