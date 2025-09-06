import { z } from 'zod'

export const GalleryCreateSchema = z.object({
  storyId: z.string(),
  ownerId: z.string(), // ID of the character/note/location
  ownerType: z.union([z.literal('character'), z.literal('note'), z.literal('location')]),
  imagePath: z.string(),
  isFile: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const GalleryUpdateSchema = z.object({
  id: z.string(),
  ownerId: z.string().optional(), // Added ownerId as optional for updates
  ownerType: z.union([z.literal('character'), z.literal('note'), z.literal('location')]).optional(),
  imagePath: z.string().optional(),
  isFile: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
})

export const GalleryResponseSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  ownerId: z.string(),
  ownerType: z.union([z.literal('character'), z.literal('note'), z.literal('location')]),
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
