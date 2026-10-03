import { z } from 'zod';
import { CurrencySchema } from './RegistrationSettingsSchemas';
import { UlidSchema } from './SyncSchemas';

/**
 * Every ceiling is nullable; `null` means "unlimited", and zero allows nothing: a free plan with every ceiling at 0
 * makes a server paid-only in practice. See `tiers` in
 * `apps/api/src/db/schema/tables/tiers.ts` for the same convention on the database side.
 */
const tierFields = {
  name: z.string().min(1, 'Name cannot be empty'),
  // Zero is a price too: a tier for sale at 0 is the free tier.
  priceMonthlyCents: z.number().int().nonnegative().nullable().optional(),
  priceYearlyCents: z.number().int().nonnegative().nullable().optional(),
  maxStories: z.number().int().nonnegative().nullable().optional(),
  maxEntitiesPerStory: z.number().int().nonnegative().nullable().optional(),
  maxEntitiesTotal: z.number().int().nonnegative().nullable().optional(),
  maxStorageBytesPerStory: z.number().int().nonnegative().nullable().optional(),
  maxStorageBytesTotal: z.number().int().nonnegative().nullable().optional(),
  // Zero is a ceiling too: a tier that may not publish at all.
  maxPublicationsPerDay: z.number().int().nonnegative().nullable().optional(),
  // Zero silences the user; messages to the administrators have a fixed cap of their own.
  maxMessagesPerDay: z.number().int().nonnegative().nullable().optional(),
};

export const TierCreateInputSchema = z.object({
  ...tierFields,
  isDefault: z.boolean().default(false),
  isPublicForSale: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
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

/**
 * What an update may carry: any of the fields, and nothing it leaves out. Not `TierCreateInputSchema.partial()`: that
 * keeps the defaults, so an update that said nothing of `isDefault`, `isPublicForSale` or `sortOrder` would have
 * been read as saying `false`, `false` and `0` - resetting them.
 */
export const PartialTierSchema = z
  .object({
    ...tierFields,
    isDefault: z.boolean(),
    isPublicForSale: z.boolean(),
    sortOrder: z.number().int(),
  })
  .partial();
export type PartialTier = z.infer<typeof PartialTierSchema>;

/** A snapshot of a user's current usage against their effective tier's ceilings. See GET /user/tier-usage. */
export const TierUsageSchema = z.object({
  tier: TierSchema.nullable(),
  storiesUsed: z.number().int(),
  storiesMax: z.number().int().nullable(),
  storageBytesUsed: z.number().int(),
  storageBytesMax: z.number().int().nullable(),
});
export type TierUsage = z.infer<typeof TierUsageSchema>;

/**
 * What a story's owner's plan allows for its entities, and what the owner already uses of it across
 * all their stories. Read by anyone who can read the story: the plan that counts is the owner's
 * (see `TierEnforcementService.payerOf`), whoever is writing. `null` ceilings are unlimited, and a
 * missing tier (no plan, no signup default) is unlimited too.
 */
export const StoryPlanSchema = z.object({
  tierName: z.string().nullable(),
  maxEntitiesPerStory: z.number().int().nullable(),
  maxEntitiesTotal: z.number().int().nullable(),
  /** The owner's live entities over all their stories, counted the way the total ceiling counts. */
  entitiesUsedTotal: z.number().int(),
});
export type StoryPlan = z.infer<typeof StoryPlanSchema>;

/**
 * One tier as the public landing page sees it: no ids of other tables, no timestamps, no
 * deletion flags - only what a visitor compares before registering. Served by
 * `GET /api/public/tiers`, already filtered (`isPublicForSale`, not deleted) and ordered.
 */
export const PublicTierSchema = z.object({
  id: UlidSchema,
  name: z.string(),
  isDefault: z.boolean(),
  priceMonthlyCents: z.number().int().nonnegative().nullable(),
  priceYearlyCents: z.number().int().nonnegative().nullable(),
  maxStories: z.number().int().nonnegative().nullable(),
  maxEntitiesPerStory: z.number().int().nonnegative().nullable(),
  maxEntitiesTotal: z.number().int().nonnegative().nullable(),
  maxStorageBytesPerStory: z.number().int().nonnegative().nullable(),
  maxStorageBytesTotal: z.number().int().nonnegative().nullable(),
  maxPublicationsPerDay: z.number().int().nonnegative().nullable(),
});
export type PublicTier = z.infer<typeof PublicTierSchema>;

export const PublicTiersResponseSchema = z.object({
  currency: CurrencySchema,
  tiers: z.array(PublicTierSchema),
});
export type PublicTiersResponse = z.infer<typeof PublicTiersResponseSchema>;
