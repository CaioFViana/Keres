import { z } from 'zod';
import { CurrencySchema } from './RegistrationSettingsSchemas';
import { UlidSchema } from './SyncSchemas';

/**
 * Every ceiling is nullable; `null` means "unlimited", and zero allows nothing: a free plan with every ceiling at 0
 * makes a server paid-only in practice. See `tiers` in
 * `apps/api/src/db/schema/tables/tiers.ts` for the same convention on the database side.
 */
/**
 * A Google Play subscription product id (`lowercase_underscored`): `null`/absent when the tier is not
 * sold in the store. Play product ids are catalog data, not secrets - the app needs them to open the
 * purchase sheet, so they travel on the public tier too.
 */
const PLAY_PRODUCT_ID_SCHEMA = z
  .string()
  .regex(/^[a-z0-9_.]{1,200}$/, 'Play product ids look like plus_monthly')
  .nullable()
  .optional();

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
  // Zero is a ceiling too: a tier that may not release a single work on its own.
  maxPublishedArcs: z.number().int().nonnegative().nullable().optional(),
  // Zero silences the user; messages to the administrators have a fixed cap of their own.
  maxMessagesPerDay: z.number().int().nonnegative().nullable().optional(),
  /**
   * The Google Play subscription product ids that sell this tier (`null` = not sold in the store).
   * The Play catalog lives outside Keres, so the administrator copies the ids from the Play Console here;
   * the relay only accepts a purchase token for the product named for the plan and period being bought.
   */
  playMonthlyProductId: PLAY_PRODUCT_ID_SCHEMA,
  playYearlyProductId: PLAY_PRODUCT_ID_SCHEMA,
  /**
   * Whether this tier is sold through web checkouts on each period. What the Play store sells is said
   * by the product ids above instead; both default to sold, which is what every tier was before.
   */
  webMonthlyEnabled: z.boolean().optional().default(true),
  webYearlyEnabled: z.boolean().optional().default(true),
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
    webMonthlyEnabled: z.boolean(),
    webYearlyEnabled: z.boolean(),
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
  // A server predating the ceiling sells none; null reads as unlimited, as for every other ceiling.
  maxPublishedArcs: z.number().int().nonnegative().nullable().default(null),
  /**
   * The store product ids that sell this tier on each period (`null` = not sold there). Catalog data,
   * not secrets: the app needs the id to open the purchase sheet, so it travels on the public tier.
   */
  playMonthlyProductId: z.string().nullable(),
  playYearlyProductId: z.string().nullable(),
  /** Whether web checkouts sell this tier on each period (a server predating the flags sold all). */
  webMonthlyEnabled: z.boolean(),
  webYearlyEnabled: z.boolean(),
});
export type PublicTier = z.infer<typeof PublicTierSchema>;

export const PublicTiersResponseSchema = z.object({
  currency: CurrencySchema,
  tiers: z.array(PublicTierSchema),
});
export type PublicTiersResponse = z.infer<typeof PublicTiersResponseSchema>;
