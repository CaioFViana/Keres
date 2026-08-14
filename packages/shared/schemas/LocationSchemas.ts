import { z } from 'zod';

export const LocationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  climate: z.string().nullable(),
  culture: z.string().nullable(),
  politics: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateLocationDataSchema = LocationSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  name: z.string().min(1, 'Location name cannot be empty'),
  isFavorite: z.boolean().default(false),
});

export const PartialLocationSchema = LocationSchema.partial();

export type CreateLocationDataType = z.infer<typeof CreateLocationDataSchema>;
export type LocationType = z.infer<typeof LocationSchema>;
export type PartialLocationType = z.infer<typeof PartialLocationSchema>;
