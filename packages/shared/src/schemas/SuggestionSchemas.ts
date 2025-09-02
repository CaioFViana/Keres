import { z } from 'zod'

export const CreateSuggestionSchema = z.object({
  userId: z.ulid(),
  scope: z.union([z.literal('global'), z.literal('story')]),
  storyId: z.ulid().nullable().optional(),
  type: z.string().min(1, 'Type cannot be empty'),
  value: z.string().min(1, 'Value cannot be empty'),
})

export const UpdateSuggestionSchema = z.object({
  id: z.ulid(),
  userId: z.ulid().optional(), // userId should not be updatable in practice
  scope: z.union([z.literal('global'), z.literal('story')]).optional(),
  storyId: z.ulid().nullable().optional(),
  type: z.string().min(1, 'Type cannot be empty').optional(),
  value: z.string().min(1, 'Value cannot be empty').optional(),
})

export const SuggestionResponseSchema = z.object({
  id: z.ulid(),
  userId: z.ulid(),
  scope: z.union([z.literal('global'), z.literal('story')]),
  storyId: z.ulid().nullable(),
  type: z.string(),
  value: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type CreateSuggestionPayload = z.infer<typeof CreateSuggestionSchema>
export type UpdateSuggestionPayload = z.infer<typeof UpdateSuggestionSchema>
export type SuggestionResponse = z.infer<typeof SuggestionResponseSchema>
