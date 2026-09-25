import {
  galleryHasFile,
  type CreateStoryUpdate,
  type DeleteStoryUpdate,
  type Gallery,
  type UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq, inArray, or } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';
import type { GallerySelect } from '../../db/schema';
import { mediaFileService } from '../MediaFileService';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/**
 * Applies a media file's *metadata* changes coming from the server locally.
 *
 * The file does not come through here. Media created on another device arrives with
 * `downloadState: 'pending'` and no `localPath`; it is `MediaSyncService` that later fetches the bytes
 * by hash. A `link` has no bytes at all, so it is already `downloaded`. That is why the local
 * columns are never read from the remote payload - they describe this device, and the server has
 * nothing to say about them.
 */
export class GalleryClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Gallery';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error('GalleryClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const data = update.data as Gallery;

    await this.db.insert(schema.galleries).values({
      ...data,
      id: update.id,
      storyId: storyId,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
      // It arrived from outside: the bytes are not on this device yet, and there is nothing to upload.
      // A link is the exception — the URL is the whole medium.
      localPath: null,
      uploadState: 'uploaded',
      downloadState: galleryHasFile(data.mediaType) ? 'pending' : 'downloaded',
    });
    console.log(`Applied create for Gallery ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const changes = update.changes as Partial<Gallery>;

    // If the content changed, the file here no longer matches the record and has to be demoted; without
    // this the media would keep showing the old version forever, since nothing else would trigger the
    // download.
    const existing = await this.getById(update.id);
    const hashChanged = !!changes.hash && !!existing && changes.hash !== existing.hash;
    const mediaType = changes.mediaType ?? existing?.mediaType;

    await this.db
      .update(schema.galleries)
      .set({
        ...changes,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
        ...(hashChanged
          ? {
              localPath: null,
              // The old video's frame belongs to the old bytes: keeping it would show the wrong
              // thumbnail until something regenerates it (which nothing would - the path exists).
              thumbnailPath: null,
              downloadState: galleryHasFile(mediaType) ? 'pending' : 'downloaded',
              uploadState: 'uploaded',
            }
          : {}),
      })
      .where(eq(schema.galleries.id, update.id));
    if (hashChanged && existing) {
      await this.deleteAbandonedFiles(storyId, [existing.localPath, existing.thumbnailPath]);
    }
    console.log(`Applied update for Gallery ${update.id} in story ${storyId}`);
  }

  /**
   * Removes files the hash swap just detached from their row. A path goes only when no other live
   * row points at it - files are content-addressed, so two media can share one file. Best-effort:
   * leftovers are wasted space, never corruption, and must not fail the sync that triggered them.
   */
  private async deleteAbandonedFiles(storyId: string, paths: Array<string | null>): Promise<void> {
    const candidates = [...new Set(paths.filter((path): path is string => !!path))];
    if (candidates.length === 0) {
      return;
    }
    try {
      const sharers = await this.db
        .select({
          localPath: schema.galleries.localPath,
          thumbnailPath: schema.galleries.thumbnailPath,
        })
        .from(schema.galleries)
        .where(
          and(
            eq(schema.galleries.storyId, storyId),
            eq(schema.galleries.isDeleted, false),
            or(
              inArray(schema.galleries.localPath, candidates),
              inArray(schema.galleries.thumbnailPath, candidates),
            ),
          ),
        );
      const shared = new Set(
        sharers
          .flatMap((row) => [row.localPath, row.thumbnailPath])
          .filter((path): path is string => !!path),
      );
      for (const path of candidates) {
        if (!shared.has(path)) {
          mediaFileService.deleteLocal(path);
        }
      }
    } catch (error) {
      console.warn('GalleryClientSyncHandler: could not delete abandoned media files.', error);
    }
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    await this.db
      .update(schema.galleries)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.galleries.id, update.id));
    console.log(`Applied delete for Gallery ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<GallerySelect | undefined> {
    return this.db.query.galleries.findFirst({
      where: eq(schema.galleries.id, id),
    });
  }
}
