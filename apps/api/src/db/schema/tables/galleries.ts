import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  table,
  text,
  timestamp,
  timestampNow,
  uniqueIndex,
} from '../columns';
import { stories } from './stories';

/**
 * A media file belonging to the story. The bytes live in `media_blobs`, addressed by the `hash`; this
 * table holds only the metadata, which synchronizes through the operation log like any other entity.
 */
export const galleries = table(
  'galleries',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    mediaType: text('media_type').notNull(), // 'image' | 'video' | 'audio' | 'document' | 'link'
    mimeType: text('mime_type').notNull(),
    fileName: text('file_name').notNull(),
    /** Content checksum; it ties this row to the corresponding blob. Links hash the URL, not bytes. */
    hash: text('hash').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    /** External URL for `mediaType: 'link'`. Never fetched by the server. */
    sourceUrl: text('source_url'),
    title: text('title'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    extraNotes: text('extra_notes'),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    // The download route checks that the story really does reference the requested hash before serving the
    // file; without this index that check would scan the table on every request.
    index('galleries_story_hash_idx').on(table.storyId, table.hash),
  ],
);

/**
 * An N:N link between a media file and an entity of the story. The owner is polymorphic, so there is no foreign key: the owner's existence is
 * validated in the synchronization handler, as in `tag_relations`.
 */
export const galleryRelations = table(
  'gallery_relations',
  {
    id: text('id').primaryKey(),
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id),
    galleryId: text('gallery_id')
      .notNull()
      .references(() => galleries.id),
    ownerId: text('owner_id').notNull(),
    ownerType: text('owner_type').notNull(),
    createdAt: timestampNow('created_at'),
    updatedAt: timestampNow('updated_at'),
    version: integer('version').notNull().default(1),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('gallery_relations_owner_idx').on(table.storyId, table.ownerType, table.ownerId),
    index('gallery_relations_gallery_idx').on(table.galleryId),
  ],
);

/**
 * A media file's bytes, addressed by content.
 *
 * Global on purpose: two users uploading the same image share one row and one file. That leaks
 * nothing, because authorization does not happen here - the download route only serves a hash after
 * confirming that the requested story has read permission *and* references that hash in `galleries`.
 */
export const mediaBlobs = table(
  'media_blobs',
  {
    hash: text('hash').primaryKey(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** Caminho relativo à raiz de armazenamento configurada. */
    storagePath: text('storage_path').notNull(),
    createdAt: timestampNow('created_at'),
  },
  (table) => [uniqueIndex('media_blobs_storage_path_idx').on(table.storagePath)],
);

export const galleriesRelations = relations(galleries, ({ one, many }) => ({
  story: one(stories, {
    fields: [galleries.storyId],
    references: [stories.id],
  }),
  owners: many(galleryRelations),
}));

export const galleryRelationsRelations = relations(galleryRelations, ({ one }) => ({
  story: one(stories, {
    fields: [galleryRelations.storyId],
    references: [stories.id],
  }),
  gallery: one(galleries, {
    fields: [galleryRelations.galleryId],
    references: [galleries.id],
  }),
}));
