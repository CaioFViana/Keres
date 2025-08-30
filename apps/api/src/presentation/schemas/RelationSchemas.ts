import { z } from 'zod'

export const createRelationSchema = z.object({
  charIdSource: z.string(),
  charIdTarget: z.string(),
  sceneId: z.string().nullable().optional(),
  momentId: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
})

export const updateRelationSchema = z.object({
  id: z.string(),
  charIdSource: z.string().optional(),
  charIdTarget: z.string().optional(),
  sceneId: z.string().nullable().optional(),
  momentId: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
})

export const relationProfileSchema = z.object({
  id: z.string(),
  charIdSource: z.string(),
  charIdTarget: z.string(),
  sceneId: z.string().nullable(),
  momentId: z.string().nullable(),
  summary: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
