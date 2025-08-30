import { z } from 'zod';

export const createMomentSchema = z.object({
  sceneId: z.string(),
  name: z.string().min(1).max(255),
  location: z.string().nullable().optional(),
  index: z.number().int().min(0),
  summary: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
});

export const updateMomentSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  name: z.string().min(1).max(255).optional(),
  location: z.string().nullable().optional(),
  index: z.number().int().min(0).optional(),
  summary: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
});

export const momentProfileSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  name: z.string(),
  location: z.string().nullable(),
  index: z.number().int().min(0),
  summary: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
