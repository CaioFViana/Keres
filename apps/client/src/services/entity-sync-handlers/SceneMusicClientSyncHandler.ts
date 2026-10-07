import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  SceneMusic,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class SceneMusicClientSyncHandler implements ClientSyncEntityHandler {
  entityName = 'SceneMusic';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;
  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction) {
    this.dbInstance = dbInstance;
  }
  private get db() {
    if (!this.dbInstance)
      throw new Error('SceneMusicClientSyncHandler: Drizzle client (db) not set.');
    return this.dbInstance;
  }
  async applyCreate(_: string, update: CreateStoryUpdate) {
    if (update.entity !== this.entityName || !update.id) return;
    const data = update.data as SceneMusic;
    await this.db.insert(schema.sceneMusic).values({
      ...data,
      id: update.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
  }
  async applyUpdate(_: string, update: UpdateStoryUpdate) {
    if (update.entity !== this.entityName || !update.id || !update.changes) return;
    const changes = update.changes as Partial<SceneMusic>;
    await this.db
      .update(schema.sceneMusic)
      .set({
        ...changes,
        updatedAt: new Date(),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.sceneMusic.id, update.id));
  }
  async applyDelete(_: string, update: DeleteStoryUpdate) {
    if (update.entity !== this.entityName || !update.id) return;
    await this.db
      .update(schema.sceneMusic)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.sceneMusic.id, update.id));
  }
  async getById(id: string): Promise<SceneMusic | undefined> {
    return this.db.query.sceneMusic.findFirst({ where: eq(schema.sceneMusic.id, id) });
  }
}
