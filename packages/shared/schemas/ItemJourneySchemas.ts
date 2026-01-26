import { z } from 'zod';

export const ItemJourneySchema = z.object({
  id: z.string(),
  storyId: z.string(),
  itemId: z.string(),
  sceneId: z.string(),
  newCharacterOwnerId: z.string().nullable(),
  newState: z.string(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.date().nullable(),
});

export const CreateItemJourneyDataSchema = ItemJourneySchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  itemId: z.string().min(1, "Item ID cannot be empty"),
  sceneId: z.string().min(1, "Scene ID cannot be empty"),
  newCharacterOwnerId: z.string().nullable().default(null),
  newState: z.string().min(1, "New state cannot be empty"),
  extraNotes: z.string().nullable().default(null),
});

export const PartialItemJourneySchema = ItemJourneySchema.partial();

export type CreateItemJourneyDataType = z.infer<typeof CreateItemJourneyDataSchema>;
export type ItemJourneyType = z.infer<typeof ItemJourneySchema>;
export type PartialItemJourneyType = z.infer<typeof PartialItemJourneySchema>;
