import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreateGalleryDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import {
  CreateGalleryDataSchema,
  isSupportedMediaMimeType,
  mediaTypeForMimeType,
  PartialGallerySchema,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { galleries } from '../../db/schema';
import { mediaStorageService } from '../MediaStorageService';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

/**
 * Synchronizes a media file's *metadata*. The bytes do not go through here: they are uploaded and
 * downloaded through the `/media` routes, addressed by the `hash` this row carries.
 *
 * There is no owner validation because media has no owner - the link to characters, locations, notes,
 * scenes and items lives in `GalleryRelationSyncHandler`.
 */
export class GallerySyncHandler extends BaseSyncEntityHandler<
  typeof CreateGalleryDataSchema,
  typeof PartialGallerySchema
> {
  entityName = 'Gallery';

  constructor() {
    super('id', 'version', CreateGalleryDataSchema, PartialGallerySchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  /**
   * Refuses formats the application could not display and a `mediaType` inconsistent with the
   * `mimeType`. Letting them through would produce media that synchronizes and then fails to open.
   */
  private assertSupportedMedia(mimeType: string, mediaType: string): void {
    if (!isSupportedMediaMimeType(mimeType)) {
      throw new Error(`Validation Error: unsupported media MIME type "${mimeType}".`);
    }
    const expected = mediaTypeForMimeType(mimeType);
    if (expected !== mediaType) {
      throw new Error(
        `Validation Error: mediaType "${mediaType}" does not match MIME type "${mimeType}" (expected "${expected}").`,
      );
    }
  }

  /**
   * A hash known to global storage can only be linked to this story if the story already references it
   * (via a tombstone included). A hash that does not exist yet is new media whose upload will come
   * later. Without this, whoever knows the MD5 of somebody else's blob creates a Gallery here and
   * downloads the file through the media route.
   */
  private async assertHashBindableToStory(storyId: string, hash: string): Promise<void> {
    const blobExists = await mediaStorageService.has(hash);
    if (!blobExists) return;

    const referencedHere = await db.query.galleries.findFirst({
      where: and(eq(galleries.storyId, storyId), eq(galleries.hash, hash)),
      columns: { id: true },
    });
    if (!referencedHere) {
      throw new SyncConflictError(
        'unauthorized',
        'Cannot bind a media hash that is not already part of this story.',
      );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateGalleryDataType = this.createSchema.parse(update.data);

    const currentGallery = await this.findById(update.id!);
    if (currentGallery) {
      throw new Error(`Conflict: Gallery with ID ${update.id} already exists.`);
    }

    this.assertSupportedMedia(validatedData.mimeType, validatedData.mediaType);
    await this.assertHashBindableToStory(storyId, validatedData.hash);

    await db.insert(galleries).values({
      id: update.id!, // Explicitly provide ID from update, as it's a ULID from client
      storyId: storyId, // Ensure storyId is set from the context
      ...validatedData, // Spread the validated data from the client
      version: 1, // Ensure version starts at 1 for new creations
      createdAt: new Date(), // Ensure createdAt is set
      updatedAt: new Date(), // Ensure updatedAt is set
      isDeleted: false, // Ensure isDeleted is false
      deletedAt: null, // Ensure deletedAt is null
    });
  }

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
  ): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    if (validatedChanges.mimeType !== undefined || validatedChanges.mediaType !== undefined) {
      this.assertSupportedMedia(
        validatedChanges.mimeType ?? currentEntity.mimeType,
        validatedChanges.mediaType ?? currentEntity.mediaType,
      );
    }

    if (validatedChanges.hash && validatedChanges.hash !== currentEntity.hash) {
      await this.assertHashBindableToStory(storyId, validatedChanges.hash);
    }

    // Delegated to the base class instead of a raw version-matched UPDATE reimplemented here:
    // that reimplementation had no `checkVersionConflict`, no `deleted_on_server` check, and
    // used server time instead of the client's `operationTime` - a concurrent edit landed here
    // with no error and no conflict reported, just silently dropped (same bug already found
    // and fixed in NoteSyncHandler/WorldRuleSyncHandler, just never cleaned up in this sibling).
    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
    // The row becomes a tombstone above, but the hash may be used by another Gallery (in the same story
    // or another, since storage is deduplicated globally) - the blob only becomes ownerless when no live
    // reference is left.
    await mediaStorageService.deleteBlobIfUnreferenced(currentEntity.hash);
  }
}
