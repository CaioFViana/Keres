import { z } from 'zod';
import { SCENE_MUSIC_ROLES } from '../entities/SceneMusic';
import { isValidRank } from '../rules/rank';

export const SceneMusicRoleSchema = z.enum(SCENE_MUSIC_ROLES);

/** Longest cue note: a line or two of direction, not a chapter. */
export const MAX_SCENE_MUSIC_CUE_LENGTH = 2_000;
/** Section labels are what the lyrics call them ("Verse 1", "Chorus"). */
export const MAX_SECTION_LABEL_LENGTH = 80;
/** More sections than any song has; the cap exists for the sync payload. */
export const MAX_SCENE_MUSIC_SECTIONS = 40;

const SectionsSchema = z
  .array(z.string().min(1).max(MAX_SECTION_LABEL_LENGTH))
  .max(MAX_SCENE_MUSIC_SECTIONS)
  .nullable();

/**
 * The stored row. Both targets may be null: a link whose Song or Gallery medium was removed keeps its
 * note and waits for another target (see `SceneMusic`).
 */
export const SceneMusicSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  sceneId: z.string(),
  rank: z.string().refine(isValidRank, 'Not a valid rank.'),
  songId: z.string().min(1).nullable(),
  galleryId: z.string().min(1).nullable(),
  role: SceneMusicRoleSchema.default('score'),
  cue: z.string().max(MAX_SCENE_MUSIC_CUE_LENGTH).nullable().default(null),
  sections: SectionsSchema.default(null),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

const SceneMusicBaseData = SceneMusicSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
});

/** A new link has exactly one target: a Song or a Gallery medium, never both and never neither. */
export const CreateSceneMusicDataSchema = SceneMusicBaseData.refine(
  (data) => (data.songId === null) !== (data.galleryId === null),
  { message: 'Music needs exactly one of a song and a gallery medium.', path: ['songId'] },
);

export const PartialSceneMusicSchema = SceneMusicBaseData.partial();

export type CreateSceneMusicDataType = z.infer<typeof CreateSceneMusicDataSchema>;
export type SceneMusicType = z.infer<typeof SceneMusicSchema>;
