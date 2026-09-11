import { z } from 'zod';

export const StoryArcSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  title: z.string().trim().min(1).max(120),
  description: z.string().nullable(),
  sortOrder: z.number().int().min(0),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  themeOverride: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateStoryArcDataSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().nullable().default(null),
  sortOrder: z.number().int().min(0).optional(),
  color: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
  themeOverride: z.string().nullable().default(null),
  isDefault: z.boolean().default(false),
});

export const PartialStoryArcSchema = CreateStoryArcDataSchema.partial();

export type CreateStoryArcDataType = z.infer<typeof CreateStoryArcDataSchema>;
export type StoryArcRowType = z.infer<typeof StoryArcSchema>;
export type PartialStoryArcType = z.infer<typeof PartialStoryArcSchema>;
