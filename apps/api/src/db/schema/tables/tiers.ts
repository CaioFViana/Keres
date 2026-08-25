import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestamp, timestampNow } from '../columns';
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
  maxStorageBytesPerStory: integer('max_storage_bytes_per_story'),
  maxStorageBytesTotal: integer('max_storage_bytes_total'),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
});

export const tiersRelations = relations(tiers, ({ many }) => ({
  users: many(users),
}));
