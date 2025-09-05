import { z } from 'zod'

export const GalleryCreateSchema = z.object({
  storyId: z.string(),
  ownerId: z.string(), // ID of the character/note/location
  imagePath: z.string().url('Invalid image URL'),
  isFile: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const GalleryUpdateSchema = z.object({
  id: z.string(),
  ownerId: z.string().optional(), // Added ownerId as optional for updates
  imagePath: z.string().url('Invalid image URL').optional(),
  isFile: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const GalleryResponseSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  ownerId: z.string(),
  imagePath: z.string(),
  isFile: z.boolean(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type GalleryCreatePayload = z.infer<typeof GalleryCreateSchema>
export type GalleryUpdatePayload = z.infer<typeof GalleryUpdateSchema>
export type GalleryResponse = z.infer<typeof GalleryResponseSchema>
