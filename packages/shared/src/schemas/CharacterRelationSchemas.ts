import { z } from 'zod'

export const CharacterRelationCreateSchema = z.object({
  charId1: z.string(),
  charId2: z.string(),
  relationType: z.string().min(1, 'Relation type cannot be empty'),
})

export const CharacterRelationUpdateSchema = z.object({
  id: z.string(),
  relationType: z.string().min(1, 'Relation type cannot be empty').optional(),
})

export const CharacterRelationResponseSchema = z.object({
  id: z.string(),
  charId1: z.string(),
  charId2: z.string(),
  relationType: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // New field for the related character's details
  relatedCharacter: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(), // Optional because it's only included when requested
})

export type CharacterRelationCreatePayload = z.infer<typeof CharacterRelationCreateSchema>
export type CharacterRelationUpdatePayload = z.infer<typeof CharacterRelationUpdateSchema>
export type CharacterRelationResponse = z.infer<typeof CharacterRelationResponseSchema>
