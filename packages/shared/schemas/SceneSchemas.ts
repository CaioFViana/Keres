import { z } from 'zod';

export const SceneSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  chapterId: z.string(),
  locationId: z.string(),
  name: z.string(),
  index: z.number(),
  summary: z.string().nullable(),
  gap: z.number().nullable(),
  gapType: z.string().nullable(),
  duration: z.number().nullable(),
  durationType: z.string().nullable(),
  isFinish: z.boolean(),
  isStart: z.boolean(),

  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.date().nullable(),
});

export const CreateSceneDataSchema = SceneSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  name: z.string().min(1, "Scene name cannot be empty"),
  index: z.number().int().min(0, "Index must be a non-negative integer"),
  isFavorite: z.boolean().default(false),
  isStart: z.boolean().default(false),
  isFinish: z.boolean().default(false),
});

export const PartialSceneSchema = SceneSchema.partial();

export type CreateSceneDataType = z.infer<typeof CreateSceneDataSchema>;
export type SceneType = z.infer<typeof SceneSchema>;
export type PartialSceneType = z.infer<typeof PartialSceneSchema>;
