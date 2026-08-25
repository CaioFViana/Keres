import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  Gallery,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { GallerySelect } from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/**
 * Applies a media file's *metadata* changes coming from the server locally.
 *
 * The file does not come through here. Media created on another device arrives with
 * `downloadState: 'pending'` and no `localPath`; it is `MediaSyncService` that later fetches the bytes
 * by hash. That is why the local columns are never read from the remote payload - they describe this
 * device, and the server has nothing to say about them.
 */
export class GalleryClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Gallery';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
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
      localPath: null,
      uploadState: 'uploaded',
      downloadState: 'pending',
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

    await this.db
      .update(schema.galleries)
      .set({
        ...changes,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
        ...(hashChanged
          ? { localPath: null, downloadState: 'pending', uploadState: 'uploaded' }
          : {}),
      })
      .where(eq(schema.galleries.id, update.id));
    console.log(`Applied update for Gallery ${update.id} in story ${storyId}`);
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
