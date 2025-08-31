import { z } from 'zod'

export const RelationCreateSchema = z.object({
  charIdSource: z.string(),
  charIdTarget: z.string(),
  sceneId: z.string().optional(),
  momentId: z.string().optional(),
  summary: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const RelationUpdateSchema = z.object({
  id: z.string(),
  charIdSource: z.string().optional(), // Should not be updatable in practice
  charIdTarget: z.string().optional(), // Should not be updatable in practice
  sceneId: z.string().optional(),
  momentId: z.string().optional(),
  summary: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const RelationResponseSchema = z.object({
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

export type RelationCreatePayload = z.infer<typeof RelationCreateSchema>
export type RelationUpdatePayload = z.infer<typeof RelationUpdateSchema>
export type RelationResponse = z.infer<typeof RelationResponseSchema>
