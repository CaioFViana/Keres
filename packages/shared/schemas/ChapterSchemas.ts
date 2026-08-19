import { z } from 'zod';

export const ChapterSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string(),
  index: z.number().int().min(1, 'Index must be a positive integer starting from 1'),
  summary: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
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
  name: z.string().min(1, 'Chapter name cannot be empty'),
  index: z.number().int().min(1, 'Index must be a positive integer starting from 1'),
  isFavorite: z.boolean().default(false),
});

export const PartialChapterSchema = CreateChapterDataSchema.partial();

export type CreateChapterDataType = z.infer<typeof CreateChapterDataSchema>;
export type ChapterType = z.infer<typeof ChapterSchema>;
export type PartialChapterType = z.infer<typeof PartialChapterSchema>;
