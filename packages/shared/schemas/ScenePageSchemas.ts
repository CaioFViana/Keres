import { z } from 'zod';
import { SCENE_PAGE_FITS } from '../entities/ScenePage';
import { isValidRank } from '../rules/rank';

export const ScenePageFitSchema = z.enum(SCENE_PAGE_FITS);

/** Longest text a page carries: a page of script, not a chapter. */
export const MAX_SCENE_PAGE_TEXT_LENGTH = 10_000;

/**
 * The stored row. Both media may be null: a page whose Sketch or Gallery medium was removed keeps
 * its text and waits for another image (see `ScenePage`).
 */
export const ScenePageSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  sceneId: z.string(),
  rank: z.string().refine(isValidRank, 'Not a valid rank.'),
  sketchId: z.string().min(1).nullable(),
  galleryId: z.string().min(1).nullable(),
  fit: ScenePageFitSchema.default('contain'),
  text: z.string().max(MAX_SCENE_PAGE_TEXT_LENGTH).nullable().default(null),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

const ScenePageBaseData = ScenePageSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
});

/** A new page has exactly one image: a Sketch or a Gallery medium, never both and never neither. */
export const CreateScenePageDataSchema = ScenePageBaseData.refine(
  (data) => (data.sketchId === null) !== (data.galleryId === null),
  { message: 'A page needs exactly one of a sketch and a gallery medium.', path: ['sketchId'] },
);

export const PartialScenePageSchema = ScenePageBaseData.partial();

export type CreateScenePageDataType = z.infer<typeof CreateScenePageDataSchema>;
export type ScenePageType = z.infer<typeof ScenePageSchema>;
