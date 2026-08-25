import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  PlotScene,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class PlotSceneClientSyncHandler implements ClientSyncEntityHandler {
  entityName = 'PlotScene';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance)
      throw new Error('PlotSceneClientSyncHandler: Drizzle client (db) not set.');
    return this.dbInstance;
  }

  async applyCreate(_: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;
    const data = update.data as PlotScene;
    await this.db.insert(schema.plotScenes).values({
      ...data,
      id: update.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
  }

  async applyUpdate(_: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id || !update.changes) return;
    const changes = update.changes as Partial<PlotScene>;
    await this.db
      .update(schema.plotScenes)
      .set({
        ...changes,
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        updatedAt: new Date(),
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.plotScenes.id, update.id));
  }

  async applyDelete(_: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;
    await this.db
      .update(schema.plotScenes)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.plotScenes.id, update.id));
  }

  async getById(id: string): Promise<PlotScene | undefined> {
    return this.db.query.plotScenes.findFirst({ where: eq(schema.plotScenes.id, id) });
  }
}
