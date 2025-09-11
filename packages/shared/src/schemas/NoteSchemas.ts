import { z } from 'zod'

export const CreateNoteSchema = z.object({
  storyId: z.string().ulid(),
  title: z.string().min(1, 'Title cannot be empty'),
  body: z.string().nullable().optional(),
  galleryId: z.string().ulid().nullable().optional(),
  isFavorite: z.boolean().optional(),
})

export const UpdateNoteSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').optional(),
  body: z.string().nullable().optional(),
  galleryId: z.string().ulid().nullable().optional(),
  isFavorite: z.boolean().optional(),
})

export const NoteResponseSchema = z.object({
  id: z.string().ulid(),
  storyId: z.string().ulid(),
  title: z.string(),
  body: z.string().nullable(),
  galleryId: z.string().ulid().nullable(),
  isFavorite: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type CreateNotePayload = z.infer<typeof CreateNoteSchema>
export type UpdateNotePayload = z.infer<typeof UpdateNoteSchema>
export type NoteResponse = z.infer<typeof NoteResponseSchema>
