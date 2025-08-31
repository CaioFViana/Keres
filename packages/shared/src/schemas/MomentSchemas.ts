import { z } from 'zod'

export const CreateMomentSchema = z.object({
  sceneId: z.string(),
  name: z.string().min(1, 'Name cannot be empty'),
  location: z.string().optional(),
  index: z.number().int().min(0, 'Index must be a non-negative integer'),
  summary: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const UpdateMomentSchema = z.object({
  id: z.string(),
  sceneId: z.string().optional(), // sceneId should not be updatable in practice
  name: z.string().min(1, 'Name cannot be empty').optional(),
  location: z.string().optional(),
  index: z.number().int().min(0, 'Index must be a non-negative integer').optional(),
  summary: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const MomentResponseSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  name: z.string(),
  location: z.string().nullable(),
  index: z.number().int(),
  summary: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type CreateMomentPayload = z.infer<typeof CreateMomentSchema>
export type UpdateMomentPayload = z.infer<typeof UpdateMomentSchema>
export type MomentResponse = z.infer<typeof MomentResponseSchema>