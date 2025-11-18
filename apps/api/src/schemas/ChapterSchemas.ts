import { z } from 'zod';

export const ChapterSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string(),
  index: z.number(),
  summary: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.date().nullable(),
});

export const CreateChapterDataSchema = ChapterSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  name: z.string().min(1, "Chapter name cannot be empty"),
  index: z.number().int().min(0, "Index must be a non-negative integer"),
  isFavorite: z.boolean().default(false),
});

export const PartialChapterSchema = ChapterSchema.partial();

export type CreateChapterDataType = z.infer<typeof CreateChapterDataSchema>;
export type ChapterType = z.infer<typeof ChapterSchema>;
export type PartialChapterType = z.infer<typeof PartialChapterSchema>;
