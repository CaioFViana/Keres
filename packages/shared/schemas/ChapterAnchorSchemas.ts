import { z } from 'zod';
import { SCENE_POSITIONS } from '../metadata/ScenePosition';

/**
 * When a container happens, said against the story's own timeline.
 *
 * One row is one **stretch**: from a moment to a moment. A container that pauses and resumes has
 * more than one - "the war runs from scene 3 to scene 9, then again from scene 14 to the end" is two
 * rows, which no interval relation can express at all.
 *
 * ## Why scenes
 *
 * The story already has a measured timeline: `storyTimelineLayout` gives every scene a start and an
 * end from its own `duration` and `gap`, in units from seconds to eons. So the axis exists and is
 * exact; what was missing was a way to attach something to it.
 *
 * A scene is the right thing to attach to because it is what the writer already wrote. Picking two
 * of them from a list is a smaller act than choosing a relation type, a target and a direction - and
 * it says something precise instead of something merely ordered.
 *
 * ## Why an offset
 *
 * Because plenty of a story's history happened before any of its scenes. "Three hundred years before
 * the first scene" places an era exactly, using a scene that exists as the thing it is measured
 * from. Without it, anything outside the reach of the spine could only be vague again.
 *
 * A negative offset means *before* the anchor, following `Scene.gap`, which already carries that
 * convention.
 */

/** One end of a stretch: a scene, a place inside it, and how far from there. */
export const ChapterAnchorPointSchema = z.object({
  sceneId: z.string().min(1),
  position: z.enum(SCENE_POSITIONS),
  /** How far from that point. Negative is before it. Absent is exactly there. */
  offset: z.number().int().nullable(),
  /** The unit `offset` is counted in, from `sceneTiming`'s vocabulary. */
  offsetUnit: z.string().nullable(),
});

export const ChapterAnchorSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  /** The container being placed - usually an event, but a chapter may be placed too. */
  chapterId: z.string(),
  /** Which stretch this is, for a container that pauses and resumes. */
  order: z.number().int().min(1),

  startSceneId: z.string(),
  startPosition: z.enum(SCENE_POSITIONS),
  startOffset: z.number().int().nullable(),
  startOffsetUnit: z.string().nullable(),

  endSceneId: z.string(),
  endPosition: z.enum(SCENE_POSITIONS),
  endOffset: z.number().int().nullable(),
  endOffsetUnit: z.string().nullable(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateChapterAnchorDataSchema = ChapterAnchorSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  order: z.number().int().min(1).default(1),
  startPosition: z.enum(SCENE_POSITIONS).default('start'),
  endPosition: z.enum(SCENE_POSITIONS).default('end'),
  startOffset: z.number().int().nullable().default(null),
  startOffsetUnit: z.string().nullable().default(null),
  endOffset: z.number().int().nullable().default(null),
  endOffsetUnit: z.string().nullable().default(null),
});

export const PartialChapterAnchorSchema = CreateChapterAnchorDataSchema.partial();

export type ChapterAnchorPointType = z.infer<typeof ChapterAnchorPointSchema>;
export type ChapterAnchorRowType = z.infer<typeof ChapterAnchorSchema>;
export type CreateChapterAnchorDataType = z.infer<typeof CreateChapterAnchorDataSchema>;
export type PartialChapterAnchorType = z.infer<typeof PartialChapterAnchorSchema>;
