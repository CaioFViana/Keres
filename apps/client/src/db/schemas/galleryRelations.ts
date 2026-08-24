import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Vínculo N:N entre uma mídia e uma entidade da história.
 *
 * Uma linha por par, com tombstone, exatamente como `tag_relations`: assim adicionar e
 * remover um vínculo sincroniza pelo mesmo caminho de qualquer outra entidade, sem
 * tratamento especial no motor.
 */
export const galleryRelations = sqliteTable('gallery_relations', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  galleryId: text('gallery_id').notNull(),
  ownerId: text('owner_id').notNull(),
  /** 'Character' | 'Location' | 'Note' | 'Scene' | 'Item' (ver `GALLERY_OWNER_ENTITIES`). */
  ownerType: text('owner_type').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type GalleryRelationInsert = InferInsertModel<typeof galleryRelations>;
export type GalleryRelationSelect = InferSelectModel<typeof galleryRelations>;
