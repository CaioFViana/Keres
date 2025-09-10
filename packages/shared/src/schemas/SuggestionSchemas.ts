import { z } from 'zod'

export const CreateSuggestionSchema = z
  .object({
    userId: z.ulid(),
    scope: z.union([z.literal('global'), z.literal('story')]),
    storyId: z.ulid().nullable().optional(),
    type: z.string().min(1, 'Type cannot be empty'),
    value: z.string().min(1, 'Value cannot be empty'),
  })
  .superRefine((data, ctx) => {
    if (data.scope === 'story' && !data.storyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'storyId is required when scope is "story"',
        path: ['storyId'],
      })
    }
  })

export const UpdateSuggestionSchema = z.object({
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
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type CreateSuggestionPayload = z.infer<typeof CreateSuggestionSchema>
export type UpdateSuggestionPayload = z.infer<typeof UpdateSuggestionSchema>
export type SuggestionResponse = z.infer<typeof SuggestionResponseSchema>

export const CreateManySuggestionsSchema = z.array(CreateSuggestionSchema)
export const UpdateManySuggestionsSchema = z.array(UpdateSuggestionSchema)

export type CreateManySuggestionsPayload = z.infer<typeof CreateManySuggestionsSchema>
export type UpdateManySuggestionsPayload = z.infer<typeof UpdateManySuggestionsSchema>

export const UserIdParamSchema = z.object({
  userId: z.ulid(),
})

export const TypeParamSchema = z.object({
  type: z.string(),
})

export const UserTypeParamSchema = z.object({
  userId: z.ulid(),
  type: z.string(),
})

export const StoryTypeParamSchema = z.object({
  storyId: z.ulid(),
  type: z.string(),
})
