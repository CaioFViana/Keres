import { z } from 'zod';

export const createLocationSchema = z.object({
  storyId: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  climate: z.string().nullable().optional(),
  culture: z.string().nullable().optional(),
  politics: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
});

export const updateLocationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  climate: z.string().nullable().optional(),
  culture: z.string().nullable().optional(),
  politics: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
});

export const locationProfileSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  climate: z.string().nullable(),
  culture: z.string().nullable(),
  politics: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
