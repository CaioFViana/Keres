import { z } from 'zod'

export const GalleryCreateSchema = z.object({
  storyId: z.string(),
  ownerId: z.string(),
  ownerType: z.union([z.literal('character'), z.literal('note'), z.literal('location')]),
  imagePath: z.string(), // This will be the original filename with extension
  isFile: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().optional(),
  file: z.instanceof(File), // The actual file
})

export const updateGallerySchema = z.object({
  id: z.string(),
  storyId: z.string(),
  ownerId: z.string().optional(),
  imagePath: z.string().url().optional(),
  isFile: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
})

export const galleryProfileSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  ownerId: z.string(),
  imagePath: z.string().url(),
  isFile: z.boolean(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
