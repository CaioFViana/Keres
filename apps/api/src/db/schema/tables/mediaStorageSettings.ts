import { table, text, timestampNow } from '../columns';

export const MEDIA_STORAGE_SETTINGS_SINGLETON_ID = 'singleton';

/**
 * Trava o banco a um destino de blobs. Isso impede que uma troca acidental de `.env` faça
 * o servidor parecer vazio e comece a gravar mídia em outro lugar.
 */
export const mediaStorageSettings = table('media_storage_settings', {
  id: text('id').primaryKey(),
  storageIdentity: text('storage_identity').notNull(),
  createdAt: timestampNow('created_at'),
  updatedAt: timestampNow('updated_at'),
});
