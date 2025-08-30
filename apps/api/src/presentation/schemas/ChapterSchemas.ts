import { z } from 'zod';

export const createChapterSchema = z.object({
  storyId: z.string(),
  name: z.string().min(1).max(255),
  index: z.number().int().min(0),
  summary: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
});

export const updateChapterSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string().min(1).max(255).optional(),
  index: z.number().int().min(0).optional(),
  summary: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
});

export const chapterProfileSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string(),
  index: z.number().int().min(0),
  summary: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
