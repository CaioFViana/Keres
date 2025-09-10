import { z } from 'zod'

import { CharacterRelationResponseSchema } from './CharacterRelationSchemas' // Import CharacterRelationResponseSchema
import { MomentResponseSchema } from './MomentSchemas' // Import MomentResponseSchema

export const CharacterCreateSchema = z.object({
  storyId: z.string(),
  name: z.string().min(1, 'Name cannot be empty'),
  gender: z.string().optional(),
  race: z.string().optional(),
  subrace: z.string().optional(),
  description: z.string().optional(),
  personality: z.string().optional(),
  motivation: z.string().optional(),
  qualities: z.string().optional(),
  weaknesses: z.string().optional(),
  biography: z.string().optional(),
  plannedTimeline: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const CharacterUpdateSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').optional(),
  gender: z.string().optional(),
  race: z.string().optional(),
  subrace: z.string().optional(),
  description: z.string().optional(),
  personality: z.string().optional(),
  motivation: z.string().optional(),
  qualities: z.string().optional(),
  weaknesses: z.string().optional(),
  biography: z.string().optional(),
  plannedTimeline: z.string().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const CharacterResponseSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string(),
  gender: z.string().nullable(),
  race: z.string().nullable(),
  subrace: z.string().nullable(),
  description: z.string().nullable(),
  personality: z.string().nullable(),
  motivation: z.string().nullable(),
  qualities: z.string().nullable(),
  weaknesses: z.string().nullable(),
  biography: z.string().nullable(),
  plannedTimeline: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Add optional fields for included data
  moments: z.array(MomentResponseSchema).optional(), // New
  relations: z.array(CharacterRelationResponseSchema).optional(), // New
})

export const CreateManyCharactersSchema = z.array(CharacterCreateSchema)
export const UpdateManyCharactersSchema = z.array(CharacterUpdateSchema)

export type CharacterCreatePayload = z.infer<typeof CharacterCreateSchema>
export type CharacterUpdatePayload = z.infer<typeof CharacterUpdateSchema>
export type CharacterResponse = z.infer<typeof CharacterResponseSchema>
export type CreateManyCharactersPayload = z.infer<typeof CreateManyCharactersSchema>
export type UpdateManyCharactersPayload = z.infer<typeof UpdateManyCharactersSchema>
