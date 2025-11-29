import { z } from 'zod';

export const ChoiceSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  sceneId: z.string(),
  nextSceneId: z.string(),
  text: z.string(),
  isImplicit: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.date().nullable(),
});

export const CreateChoiceDataSchema = ChoiceSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  sceneId: z.string().min(1, "Scene ID cannot be empty"),
  nextSceneId: z.string().min(1, "Next Scene ID cannot be empty"),
  text: z.string().min(1, "Choice text cannot be empty"),
  isImplicit: z.boolean().default(false),
});

export const PartialChoiceSchema = ChoiceSchema.partial();

export type CreateChoiceDataType = z.infer<typeof CreateChoiceDataSchema>;
export type ChoiceType = z.infer<typeof ChoiceSchema>;
export type PartialChoiceType = z.infer<typeof PartialChoiceSchema>;
