import { z } from 'zod';

export const GallerySchema = z.object({
  id: z.string(),
  storyId: z.string(),
  ownerId: z.string(), // Can refer to character.id, notes.id, or locations.id
  ownerType: z.enum(['Character', 'Location', 'Note', 'Scene']).nullable(),
  imagePath: z.string(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.date().nullable(),
});

export const CreateGalleryDataSchema = GallerySchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  imagePath: z.string().min(1, "Image path cannot be empty"),
  isFavorite: z.boolean().default(false),
  ownerType: z.enum(['Character', 'Location', 'Note', 'Scene']).nullable(),
});

export const PartialGallerySchema = GallerySchema.partial();

export type CreateGalleryDataType = z.infer<typeof CreateGalleryDataSchema>;
export type GalleryType = z.infer<typeof GallerySchema>;
export type PartialGalleryType = z.infer<typeof PartialGallerySchema>;
