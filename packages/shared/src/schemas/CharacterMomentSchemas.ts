import { z } from 'zod'

export const CharacterMomentCreateSchema = z.object({
  characterId: z.string(),
  momentId: z.string(),
})

export const CharacterMomentUpdateSchema = z.object({
  characterId: z.string(),
  momentId: z.string(),
})

export const CharacterMomentResponseSchema = z.object({
  characterId: z.string(),
  momentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type CharacterMomentCreatePayload = z.infer<typeof CharacterMomentCreateSchema>
export type CharacterMomentUpdatePayload = z.infer<typeof CharacterMomentUpdateSchema>
export type CharacterMomentResponse = z.infer<typeof CharacterMomentResponseSchema>

export const CreateManyCharacterMomentsSchema = z.array(CharacterMomentCreateSchema)
export const UpdateManyCharacterMomentsSchema = z.array(CharacterMomentUpdateSchema)

export type CreateManyCharacterMomentsPayload = z.infer<typeof CreateManyCharacterMomentsSchema>
export type UpdateManyCharacterMomentsPayload = z.infer<typeof UpdateManyCharacterMomentsSchema>
