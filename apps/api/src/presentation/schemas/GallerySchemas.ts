import { z } from 'zod'

export const createGallerySchema = z.object({
  storyId: z.string(),
  ownerId: z.string(), // Can refer to character.id, notes.id, or locations.id
  imagePath: z.string().url(),
  isFile: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  extraNotes: z.string().nullable().optional(),
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
