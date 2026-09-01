import { z } from 'zod';
import { WORLD_PIECE_SECTIONS } from '../entities/WorldRule';

export const WorldRuleSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  // Defaults retain import compatibility for packages exported before World Pieces existed.
  section: z.enum(WORLD_PIECE_SECTIONS).default('rule'),
  type: z.string().nullable().default(null),
  category: z.string().nullable().default(null),
  behavior: z.string().nullable().default(null),
  usability: z.string().nullable().default(null),
  danger: z.string().nullable().default(null),
  isFavorite: z.boolean(),
  extraNotes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
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
  title: z.string().min(1, 'World Rule title cannot be empty'),
  section: z.enum(WORLD_PIECE_SECTIONS).default('rule'),
  type: z.string().nullable().default(null),
  category: z.string().nullable().default(null),
  behavior: z.string().nullable().default(null),
  usability: z.string().nullable().default(null),
  danger: z.string().nullable().default(null),
  isFavorite: z.boolean().default(false),
});

export const PartialWorldRuleSchema = CreateWorldRuleDataSchema.partial();

export type CreateWorldRuleDataType = z.infer<typeof CreateWorldRuleDataSchema>;
export type WorldRuleType = z.infer<typeof WorldRuleSchema>;
export type PartialWorldRuleType = z.infer<typeof PartialWorldRuleSchema>;
