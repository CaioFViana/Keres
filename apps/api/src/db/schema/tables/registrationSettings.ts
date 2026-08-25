import { relations } from 'drizzle-orm';
import { boolean, integer, table, text, timestampNow } from '../columns';
import { tiers } from './tiers';

/**
 * Global registration configuration. A single-row table - `id` is always the literal 'singleton', so
 * the app finds the row by that constant instead of maintaining a separate lookup table.
 * `RegistrationSettingsService` creates that row on demand at the first read if it does not exist yet,
 * so no migration/seed has to insert data.
 */
export const REGISTRATION_SETTINGS_SINGLETON_ID = 'singleton';

export const registrationSettings = table('registration_settings', {
  id: text('id').primaryKey(),
  isRegistrationOpen: boolean('is_registration_open').notNull().default(true),
  /** null = no user ceiling. */
  maxUsers: integer('max_users'),
  /**
   * When true, `isRegistrationOpen` is recomputed on every signup attempt from `maxUsers` (current
   * users < maxUsers), instead of using the value stored below. When false, `isRegistrationOpen` is the
   * administrator's manual switch.
   */
  autoManage: boolean('auto_manage').notNull().default(false),
  defaultTierId: text('default_tier_id').references(() => tiers.id),
  updatedAt: timestampNow('updated_at'),
});

export const registrationSettingsRelations = relations(registrationSettings, ({ one }) => ({
  defaultTier: one(tiers, {
    fields: [registrationSettings.defaultTierId],
    references: [tiers.id],
  }),
}));
