import { z } from 'zod'

export const createSceneSchema = z.object({
  chapterId: z.string(),
  name: z.string().min(1).max(255),
  index: z.number().int().min(0),
  summary: z.string().nullable().optional(),
  gap: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
})

export const updateSceneSchema = z.object({
  id: z.string(),
  chapterId: z.string(),
  name: z.string().min(1).max(255).optional(),
  index: z.number().int().min(0).optional(),
  summary: z.string().nullable().optional(),
  gap: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
})

export const sceneProfileSchema = z.object({
  id: z.string(),
  chapterId: z.string(),
  name: z.string(),
  index: z.number().int().min(0),
  summary: z.string().nullable(),
  gap: z.string().nullable(),
  duration: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
