import { z } from 'zod';
import { UlidSchema } from './SyncSchemas';

/**
 * Todo teto é nullable; `null` significa "ilimitado". Ver `tiers` em
 * `apps/api/src/db/schema/tables/tiers.ts` para a mesma convenção do lado do banco.
 */
export const TierCreateInputSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty'),
  isDefault: z.boolean().default(false),
  maxStories: z.number().int().positive().nullable().optional(),
  maxEntitiesPerStory: z.number().int().positive().nullable().optional(),
  maxEntitiesTotal: z.number().int().positive().nullable().optional(),
  maxStorageBytesPerStory: z.number().int().positive().nullable().optional(),
  maxStorageBytesTotal: z.number().int().positive().nullable().optional(),
});
export type TierCreateInput = z.infer<typeof TierCreateInputSchema>;

// `Tier` (the full-row type) is `entities/Tier.ts` - not re-inferred here, to avoid a
// duplicate export colliding with it through the package barrel.
export const TierSchema = TierCreateInputSchema.extend({
  id: UlidSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  isDeleted: z.boolean().default(false),
  deletedAt: z.coerce.date().nullable().optional(),
});

export const PartialTierSchema = TierCreateInputSchema.partial();
export type PartialTier = z.infer<typeof PartialTierSchema>;

/** Snapshot do uso atual de um usuário comparado aos tetos do seu tier efetivo. Ver GET /user/tier-usage. */
export const TierUsageSchema = z.object({
  tier: TierSchema.nullable(),
  storiesUsed: z.number().int(),
  storiesMax: z.number().int().nullable(),
  storageBytesUsed: z.number().int(),
  storageBytesMax: z.number().int().nullable(),
});
export type TierUsage = z.infer<typeof TierUsageSchema>;
