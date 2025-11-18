import { z } from 'zod';

export const WorldRuleSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.date().nullable(),
});

export const CreateWorldRuleDataSchema = WorldRuleSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  title: z.string().min(1, "World Rule title cannot be empty"),
  isFavorite: z.boolean().default(false),
});

export const PartialWorldRuleSchema = WorldRuleSchema.partial();

export type CreateWorldRuleDataType = z.infer<typeof CreateWorldRuleDataSchema>;
export type WorldRuleType = z.infer<typeof WorldRuleSchema>;
export type PartialWorldRuleType = z.infer<typeof PartialWorldRuleSchema>;
