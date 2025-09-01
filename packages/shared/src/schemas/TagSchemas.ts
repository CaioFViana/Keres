import { z } from 'zod'

export const CreateTagSchema = z.object({
  storyId: z.string().ulid(),
  name: z.string().min(1, 'Name cannot be empty'),
  color: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
})

export const UpdateTagSchema = z.object({
  id: z.string().ulid(),
  storyId: z.string().ulid().optional(), // storyId should not be updatable in practice
  name: z.string().min(1, 'Name cannot be empty').optional(),
  color: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
})

export const TagResponseSchema = z.object({
  id: z.string().ulid(),
  storyId: z.string().ulid(),
  name: z.string(),
  color: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type CreateTagPayload = z.infer<typeof CreateTagSchema>
export type UpdateTagPayload = z.infer<typeof UpdateTagSchema>
export type TagResponse = z.infer<typeof TagResponseSchema>
