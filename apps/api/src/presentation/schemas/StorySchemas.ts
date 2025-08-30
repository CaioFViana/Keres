import { z } from 'zod';

export const createStorySchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(255),
  summary: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
});

export const updateStorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().min(1).max(255).optional(),
  summary: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
});

export const storyProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  genre: z.string().nullable(),
  language: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
