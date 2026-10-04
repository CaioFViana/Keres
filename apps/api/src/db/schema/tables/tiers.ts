import { relations } from 'drizzle-orm';
import { bigintNumber, boolean, integer, table, text, timestamp, timestampNow } from '../columns';
import { users } from './users';

/**
 * A subscription plan: it defines the usage ceilings `TierEnforcementService` enforces.
 *
 * This table's convention: every `max*` column is nullable, and `null` means "unlimited" - instead of
 * a separate `*Unlimited` column for each ceiling, which would double the number of columns. The same
 * idea already used by `deletedAt` in the rest of the schema.
 */
export const tiers = table('tiers', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  /** A convenience for the UI; the source of truth for which tier new signups receive is */
  isDefault: boolean('is_default').notNull().default(false),
  maxStories: integer('max_stories'),
  maxEntitiesPerStory: integer('max_entities_per_story'),
  maxEntitiesTotal: integer('max_entities_total'),
  /** `bigint`: a 32-bit integer tops out at ~2 GB, and tiers comfortably exceed that. */
  maxStorageBytesPerStory: bigintNumber('max_storage_bytes_per_story'),
  maxStorageBytesTotal: bigintNumber('max_storage_bytes_total'),
  /** Versions published in any rolling 24 hours (see `publication_log`); 0 forbids publishing. */
  maxPublicationsPerDay: integer('max_publications_per_day'),
  /** Messages to other users in any rolling 24 hours (see `message_log`); 0 silences the user. */
  maxMessagesPerDay: integer('max_messages_per_day'),
  /** Monthly price in the system's currency minor units; `null` = not priced monthly, 0 = free. */
  priceMonthlyCents: integer('price_monthly_cents'),
  /** Yearly price in the system's currency minor units; `null` = not priced yearly, 0 = free. */
  priceYearlyCents: integer('price_yearly_cents'),
  /**
   * Google Play subscription product ids selling this tier (`null` = not sold in the store).
   * Copied from the Play Console by the administrator; the relay only accepts a purchase token
   * for the product named for the plan and period being bought.
   */
  playMonthlyProductId: text('play_monthly_product_id'),
  playYearlyProductId: text('play_yearly_product_id'),
  /**
   * Whether web checkouts sell this tier on each period (on by default: every tier was web-sold
   * before, and what the Play store sells is said by the product ids above instead).
   */
  webMonthlyEnabled: boolean('web_monthly_enabled').notNull().default(true),
  webYearlyEnabled: boolean('web_yearly_enabled').notNull().default(true),
  /** Listed by `GET /api/public/tiers` for the landing page; off by default like the showcase. */
  isPublicForSale: boolean('is_public_for_sale').notNull().default(false),
  /** Display order on the landing page (ascending), then by name. */
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const tiersRelations = relations(tiers, ({ many }) => ({
  users: many(users),
}));
