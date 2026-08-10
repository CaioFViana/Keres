import { text, timestamp, pgTable } from 'drizzle-orm/pg-core';

export const MEDIA_STORAGE_SETTINGS_SINGLETON_ID = 'singleton';

/**
 * Trava o banco a um destino de blobs. Isso impede que uma troca acidental de `.env` faça
 * o servidor parecer vazio e comece a gravar mídia em outro lugar.
 */
export const mediaStorageSettings = pgTable('media_storage_settings', {
  id: text('id').primaryKey(),
  storageIdentity: text('storage_identity').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
