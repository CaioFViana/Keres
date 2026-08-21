import { z } from 'zod';

export const ModeSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  characterId: z.string().min(1, 'Character ID cannot be empty'),
  name: z.string().min(1, 'Mode name cannot be empty'),
  modeChanges: z.string().nullable(),
  order: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateModeDataSchema = ModeSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  modeChanges: z.string().nullable().default(null),
  order: z.number().int().default(0),
});

export const PartialModeSchema = CreateModeDataSchema.partial();

export type CreateModeDataType = z.infer<typeof CreateModeDataSchema>;
export type ModeType = z.infer<typeof ModeSchema>;
export type PartialModeType = z.infer<typeof PartialModeSchema>;
