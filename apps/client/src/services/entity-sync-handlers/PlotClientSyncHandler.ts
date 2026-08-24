import { CreateStoryUpdate, DeleteStoryUpdate, Plot, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class PlotClientSyncHandler implements ClientSyncEntityHandler {
  entityName = 'Plot';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) throw new Error('PlotClientSyncHandler: Drizzle client (db) not set.');
    return this.dbInstance;
  }

  async applyCreate(_: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;
    const data = update.data as Plot;
    await this.db.insert(schema.plots).values({
      ...data,
      id: update.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
  }

  async applyUpdate(_: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id || !update.changes) return;
    const changes = update.changes as Partial<Plot>;
    await this.db
      .update(schema.plots)
      .set({
        ...changes,
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        updatedAt: new Date(),
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.plots.id, update.id));
  }

  async applyDelete(_: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;
    await this.db
      .update(schema.plots)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.plots.id, update.id));
  }

  async getById(id: string): Promise<Plot | undefined> {
    return this.db.query.plots.findFirst({ where: eq(schema.plots.id, id) });
  }
}
