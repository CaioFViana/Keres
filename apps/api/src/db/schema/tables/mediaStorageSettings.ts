import { table, text, timestampNow } from '../columns';

export const MEDIA_STORAGE_SETTINGS_SINGLETON_ID = 'singleton';

/**
 * Locks the database to one blob destination. That stops an accidental `.env` switch from making the
 * server look empty and starting to write media somewhere else.
 */
export const mediaStorageSettings = table('media_storage_settings', {
  id: text('id').primaryKey(),
  storageIdentity: text('storage_identity').notNull(),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
});
