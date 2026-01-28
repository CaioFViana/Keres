import { CreateStoryUpdate, DeleteStoryUpdate, Scene, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class SceneClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Scene';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('SceneClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(entityId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const data = update.data as Scene;

    await this.db.insert(schema.scenes).values({
      ...data,
      id: update.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
    console.log(`Applied create for Scene ${update.id}`);
  }

  async applyUpdate(entityId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const changes = update.changes as Partial<Scene>;

    await this.db.update(schema.scenes)
      .set({
        ...changes,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.scenes.id, update.id));
    console.log(`Applied update for Scene ${update.id}`);
  }

  async applyDelete(entityId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName}`);
      return;
    }

    await this.db.update(schema.scenes)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.scenes.id, update.id));
    console.log(`Applied delete for Scene ${update.id}`);
  }

  async getById(id: string): Promise<Scene | undefined> {
    const entity = await this.db.query.scenes.findFirst({
      where: eq(schema.scenes.id, id),
    });
    return entity;
  }
}
