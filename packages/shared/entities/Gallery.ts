import type { MediaType } from '../schemas/GallerySchemas';

/**
 * A media file belonging to the story (image, video or audio).
 *
 * The file is identified by its content (`hash`), not by its path: that is what lets the same
 * media be reused by several entities and what makes it possible to detect, during
 * synchronization, whether the bytes changed. The file's local path on the device is the client's
 * concern and is not part of this interface.
 */
export interface Gallery {
  id: string;
  storyId: string;
  mediaType: MediaType;
  mimeType: string;
  fileName: string;
  /** Checksum of the content in hex (see `MediaHashSchema`). */
  hash: string;
  sizeBytes: number;
  title: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isDeleted: boolean; // Added for conflict resolution (tombstones)
  deletedAt: Date | null; // Added for conflict resolution (tombstones)
}
