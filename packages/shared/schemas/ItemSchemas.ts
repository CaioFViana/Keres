import { z } from 'zod';

export const ItemSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  characterOwnerId: z.string().nullable(),
  name: z.string().min(1, 'Item name cannot be empty'),
  category: z.string().nullable(),
  description: z.string().nullable(),
  initialState: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateItemDataSchema = ItemSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  name: z.string().min(1, 'Item name cannot be empty'),
  characterOwnerId: z.string().nullable().default(null), // Added
  category: z.string().nullable().default(null), // Added
  description: z.string().nullable().default(null),
  initialState: z.string().nullable().default(null), // Added
  isFavorite: z.boolean().default(false),
  extraNotes: z.string().nullable().default(null),
});

export const PartialItemSchema = CreateItemDataSchema.partial();

export type CreateItemDataType = z.infer<typeof CreateItemDataSchema>;
export type ItemType = z.infer<typeof ItemSchema>;
export type PartialItemType = z.infer<typeof PartialItemSchema>;
