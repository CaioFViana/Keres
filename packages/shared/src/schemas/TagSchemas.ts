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

export const TagTargetTypeSchema = z.enum(['Character', 'Location', 'Chapter', 'Scene'])

export const TagAssignmentSchema = z.object({
  tagId: z.string().ulid(),
  targetType: TagTargetTypeSchema,
  targetId: z.string().ulid(),
})

export const TagRemovalSchema = z.object({
  tagId: z.string().ulid(),
  targetType: TagTargetTypeSchema,
  targetId: z.string().ulid(),
})

export type CreateTagPayload = z.infer<typeof CreateTagSchema>
export type UpdateTagPayload = z.infer<typeof UpdateTagSchema>
export type TagResponse = z.infer<typeof TagResponseSchema>
export type TagTargetType = z.infer<typeof TagTargetTypeSchema>
export type TagAssignmentPayload = z.infer<typeof TagAssignmentSchema>
export type TagRemovalPayload = z.infer<typeof TagRemovalSchema>
