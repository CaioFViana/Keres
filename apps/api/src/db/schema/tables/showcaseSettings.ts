import { boolean, table, text, timestampNow } from '../columns';

/**
 * Global Showcase configuration. A single-row table, the same pattern as `registration_settings`:
 * `id` is always the literal 'singleton', and `ShowcaseSettingsService` creates the row on demand at
 * the first read - no migration has to insert data.
 *
 * Off by default on purpose: bringing the API up must not, on its own, put a public site on the air.
 * Whoever hosts it decides whether that server has a public face.
 */
export const SHOWCASE_SETTINGS_SINGLETON_ID = 'singleton';

export const showcaseSettings = table('showcase_settings', {
  id: text('id').primaryKey(),
  isShowcaseEnabled: boolean('is_showcase_enabled').notNull().default(false),
  /** The Expo client hosted at `/`; when off, the root becomes the server's minimal landing page. */
  isHostedClientEnabled: boolean('is_hosted_client_enabled').notNull().default(true),
  updatedAt: timestampNow('updated_at'),
});
