import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A story's medium.
 *
 * The columns split into two natures. The first ones describe the medium and synchronize
 * with the server like any other entity. The last ones (`localPath`, `uploadState`,
 * `downloadState`) describe *this device's* state and are never sent: they do not
 * exist in the shared `GallerySchema`, and the server's zod discards unknown
 * keys, so even travelling along in the payload they stop at the border.
 */
export const galleries = sqliteTable('galleries', {
  id: text('id').primaryKey(),
  storyId: text('story_id').notNull(),
  mediaType: text('media_type').notNull(), // 'image' | 'video' | 'audio'
  mimeType: text('mime_type').notNull(),
  fileName: text('file_name').notNull(),
  /** The content's checksum; it is by this that the file is located here and on the server. */
  hash: text('hash').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  title: text('title'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  extraNotes: text('extra_notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  version: integer('version').notNull(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),

  // --- Local state, not synchronized ---

  /** The `file://` of the file on this device. Null while the medium came from the server and has not been downloaded yet. */
  localPath: text('local_path'),
  /** 'pending' | 'uploaded' | 'failed' — whether the bytes have reached the server. */
  uploadState: text('upload_state').notNull().default('pending'),
  /** 'pending' | 'downloaded' | 'failed' — whether the bytes have reached this device. */
  downloadState: text('download_state').notNull().default('downloaded'),
  /**
   * A frame extracted from a video, to show in grids/strips without mounting a player per
   * cell. It only applies to `mediaType: 'video'`; an image uses the file itself and audio has
   * no frame to extract.
   */
  thumbnailPath: text('thumbnail_path'),
});

export type GalleryInsert = InferInsertModel<typeof galleries>;
export type GallerySelect = InferSelectModel<typeof galleries>;

export type MediaTransferState = 'pending' | 'uploaded' | 'downloaded' | 'failed';
