import { z } from 'zod'

import { SceneResponseSchema } from './SceneSchemas' // Import SceneResponseSchema

export const ChapterCreateSchema = z.object({
  storyId: z.string(),
  name: z.string().min(1, 'Name cannot be empty'),
  index: z.number().int().min(0, 'Index must be a non-negative integer'),
  summary: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const ChapterUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name cannot be empty').optional(),
  index: z.number().int().min(0, 'Index must be a non-negative integer').optional(),
  summary: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const ChapterResponseSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string(),
  index: z.number().int(),
  summary: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  scenes: z.array(SceneResponseSchema).optional(),
})

export type ChapterCreatePayload = z.infer<typeof ChapterCreateSchema>
export type ChapterUpdatePayload = z.infer<typeof ChapterUpdateSchema>
export type ChapterResponse = z.infer<typeof ChapterResponseSchema>
