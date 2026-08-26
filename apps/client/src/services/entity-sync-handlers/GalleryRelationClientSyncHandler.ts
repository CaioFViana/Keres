import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  GalleryRelation,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { GalleryRelationSelect } from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class GalleryRelationClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'GalleryRelation';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('GalleryRelationClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const data = update.data as GalleryRelation;

    await this.db.insert(schema.galleryRelations).values({
      ...data,
      id: update.id,
      storyId: storyId,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
    console.log(`Applied create for GalleryRelation ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const changes = update.changes as Partial<GalleryRelation>;

    await this.db
      .update(schema.galleryRelations)
      .set({
        ...changes,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.galleryRelations.id, update.id));
    console.log(`Applied update for GalleryRelation ${update.id} in story ${storyId}`);
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    await this.db
      .update(schema.galleryRelations)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.galleryRelations.id, update.id));
    console.log(`Applied delete for GalleryRelation ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<GalleryRelationSelect | undefined> {
    return this.db.query.galleryRelations.findFirst({
      where: eq(schema.galleryRelations.id, id),
    });
  }
}
