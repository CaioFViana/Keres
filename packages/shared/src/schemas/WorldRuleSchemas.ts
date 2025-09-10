import { z } from 'zod'

export const CreateWorldRuleSchema = z.object({
  storyId: z.ulid(),
  title: z.string().min(1, 'Title cannot be empty'),
  description: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
})

export const UpdateWorldRuleSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').optional(),
  description: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
})

export const WorldRuleResponseSchema = z.object({
  id: z.ulid(),
  storyId: z.ulid(),
  title: z.string(),
  description: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type CreateWorldRulePayload = z.infer<typeof CreateWorldRuleSchema>
export type UpdateWorldRulePayload = z.infer<typeof UpdateWorldRuleSchema>
export type WorldRuleResponse = z.infer<typeof WorldRuleResponseSchema>
