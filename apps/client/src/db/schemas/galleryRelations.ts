import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * An N:N link between a medium and a story entity.
 *
 * One row per pair, with a tombstone, exactly like `tag_relations`: that way adding and
 * removing a link synchronizes through the same path as any other entity, with no
 * special treatment in the engine.
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
