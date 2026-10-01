import { z } from 'zod';
import { RANK_FIELD_MAX, RankFieldSchema } from './RankSchemas';

// --- Stat ---------------------------------------------------------------------------------

export const StatSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  name: z.string().min(1, 'Stat name cannot be empty'),
  isPrimary: z.boolean(),
  order: z.number().int(),
  /** The stat's place in the story's list (see `SceneSchema.rank`); `order` is derived from it. */
  rank: z.string().max(RANK_FIELD_MAX).default(''),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateStatDataSchema = StatSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  isPrimary: z.boolean().default(true),
  order: z.number().int().default(0),
  // Optional with no default, like `CreateSceneDataSchema.rank`.
  rank: RankFieldSchema.optional(),
});

export const PartialStatSchema = CreateStatDataSchema.partial();

export type CreateStatDataType = z.infer<typeof CreateStatDataSchema>;
export type StatType = z.infer<typeof StatSchema>;
export type PartialStatType = z.infer<typeof PartialStatSchema>;

// --- StatStrength -------------------------------------------------------------------------

export const StatStrengthSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  statId: z.string().nullable(),
  label: z.string().min(1, 'Tier label cannot be empty'),
  // The rung's floor. A negative value makes no sense on a ladder that always opens at zero.
  minValue: z.number().min(0, 'Tier value cannot be negative'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateStatStrengthDataSchema = StatStrengthSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  statId: z.string().nullable().default(null),
});

export const PartialStatStrengthSchema = CreateStatStrengthDataSchema.partial().extend({
  statId: z.string().nullable().optional(),
});

export type CreateStatStrengthDataType = z.infer<typeof CreateStatStrengthDataSchema>;
export type StatStrengthType = z.infer<typeof StatStrengthSchema>;
export type PartialStatStrengthType = z.infer<typeof PartialStatStrengthSchema>;

// --- StatRelation -------------------------------------------------------------------------

export const StatRelationSchema = z.object({
  id: z.string(),
  storyId: z.string(),
  characterId: z.string().min(1, 'Character ID cannot be empty'),
  modeId: z.string().nullable(),
  statId: z.string().min(1, 'Stat ID cannot be empty'),
  value: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number(),
  isDeleted: z.boolean(),
  deletedAt: z.coerce.date().nullable(),
});

export const CreateStatRelationDataSchema = StatRelationSchema.omit({
  id: true,
  storyId: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  isDeleted: true,
  deletedAt: true,
}).extend({
  modeId: z.string().nullable().default(null),
});

export const PartialStatRelationSchema = CreateStatRelationDataSchema.partial().extend({
  modeId: z.string().nullable().optional(),
});

export type CreateStatRelationDataType = z.infer<typeof CreateStatRelationDataSchema>;
export type StatRelationType = z.infer<typeof StatRelationSchema>;
export type PartialStatRelationType = z.infer<typeof PartialStatRelationSchema>;
