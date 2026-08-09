import { z } from 'zod';
import { UlidSchema } from './SyncSchemas';

export const FavoriteEntityTypeSchema = z.enum([
  'Story',
  'Character',
  'Chapter',
  'Location',
  'Scene',
  'Note',
  'WorldRule',
  'Item',
  'Gallery',
  'Tag',
]);

export const FavoriteSchema = z.object({
  id: UlidSchema,
  storyId: UlidSchema,
  entityId: UlidSchema,
  entityType: FavoriteEntityTypeSchema,
  userId: UlidSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number().int().min(1),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateFavoriteDataSchema = FavoriteSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
});

export const PartialFavoriteSchema = FavoriteSchema.partial();

export type FavoriteType = z.infer<typeof FavoriteSchema>;
export type CreateFavoriteDataType = z.infer<typeof CreateFavoriteDataSchema>;
