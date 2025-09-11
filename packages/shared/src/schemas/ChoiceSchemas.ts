import { z } from 'zod'

export const CreateChoiceSchema = z.object({
  sceneId: z.string(),
  nextSceneId: z.string(),
  text: z.string().min(1, 'Choice text cannot be empty'),
  isImplicit: z.boolean().optional().default(false),
})

export const UpdateChoiceSchema = z.object({
  id: z.string(),
  sceneId: z.string().optional(),
  nextSceneId: z.string().optional(),
  text: z.string().min(1, 'Choice text cannot be empty').optional(),
})

export const ChoiceResponseSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  nextSceneId: z.string(),
  text: z.string(),
  isImplicit: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type CreateChoicePayload = z.infer<typeof CreateChoiceSchema>
export type UpdateChoicePayload = z.infer<typeof UpdateChoiceSchema>
export type ChoiceResponse = z.infer<typeof ChoiceResponseSchema>

export const SceneIdParamSchema = z.object({
  sceneId: z.string().ulid(),
})
