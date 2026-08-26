import { z } from 'zod';

// PostgreSQL `integer` is the narrowest persistence target; keeping this bound in the shared
// contract prevents a local SQLite value from becoming impossible to synchronize later.
const SceneTimingValueSchema = z
  .number()
  .int('Scene timing must be a whole number')
  .finite('Scene timing must be finite')
  .min(-2147483648)
  .max(2147483647)
  .nullable();

export const SceneSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  chapterId: z.string(),
  locationId: z.string(),
  name: z.string(),
  index: z.number(),
  summary: z.string().nullable(),
  gap: SceneTimingValueSchema,
  gapType: z.string().nullable(),
  duration: SceneTimingValueSchema,
  durationType: z.string().nullable(),
  isFinish: z.boolean(),
  isStart: z.boolean(),

  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
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
  name: z.string().min(1, 'Scene name cannot be empty'),
  // 1..N within the chapter, like the chapter index: it is what the API requires when reordering, and
  // accepting 0 here is what left creation and reordering with incompatible contracts.
  index: z.number().int().min(1, 'Index must be a positive integer starting from 1'),
  isFavorite: z.boolean().default(false),
  isStart: z.boolean().default(false),
  isFinish: z.boolean().default(false),
});

export const PartialSceneSchema = CreateSceneDataSchema.partial();

export type CreateSceneDataType = z.infer<typeof CreateSceneDataSchema>;
export type SceneType = z.infer<typeof SceneSchema>;
export type PartialSceneType = z.infer<typeof PartialSceneSchema>;
