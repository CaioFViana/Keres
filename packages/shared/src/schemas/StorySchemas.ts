import { z } from 'zod'

import { ChapterResponseSchema } from './ChapterSchemas' // Import ChapterResponseSchema
import { CharacterResponseSchema } from './CharacterSchemas' // Import CharacterResponseSchema
import { LocationResponseSchema } from './LocationSchemas' // Import LocationResponseSchema

export const StoryCreateSchema = z.object({
  userId: z.string(),
  type: z.enum(['linear', 'branching']).optional().default('linear'),
  title: z.string().min(1, 'Title cannot be empty'),
  summary: z.string().optional(),
  genre: z.string().optional(),
  language: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const StoryUpdateSchema = z.object({
  id: z.string(),
  type: z.enum(['linear', 'branching']).optional(),
  title: z.string().min(1, 'Name cannot be empty').optional(),
  summary: z.string().optional(),
  genre: z.string().optional(),
  language: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const StoryResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(['linear', 'branching']),
  title: z.string(),
  summary: z.string().nullable(),
  genre: z.string().nullable(),
  language: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Add optional fields for included data
  characters: z.array(CharacterResponseSchema).optional(), // New
  chapters: z.array(ChapterResponseSchema).optional(), // New
  locations: z.array(LocationResponseSchema).optional(), // New
})

export type StoryCreatePayload = z.infer<typeof StoryCreateSchema>
export type StoryUpdatePayload = z.infer<typeof StoryUpdateSchema>
export type StoryResponse = z.infer<typeof StoryResponseSchema>
