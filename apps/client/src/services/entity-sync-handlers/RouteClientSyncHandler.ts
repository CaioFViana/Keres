import type { CreateStoryUpdate, DeleteStoryUpdate, Route, UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class RouteClientSyncHandler implements ClientSyncEntityHandler {
  entityName = 'Route';
  private dbInstance: AppDrizzleClient | null = null;
  setDb(dbInstance: AppDrizzleClient) {
    this.dbInstance = dbInstance;
  }
  private get db() {
    if (!this.dbInstance) throw new Error('RouteClientSyncHandler: Drizzle client (db) not set.');
    return this.dbInstance;
  }
  async applyCreate(_: string, update: CreateStoryUpdate) {
    if (update.entity !== this.entityName || !update.id) return;
    const data = update.data as Route;
    await this.db.insert(schema.routes).values({
      ...data,
      id: update.id,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : null,
    });
  }
  async applyUpdate(_: string, update: UpdateStoryUpdate) {
    if (update.entity !== this.entityName || !update.id || !update.changes) return;
    const changes = update.changes as Partial<Route>;
    await this.db
      .update(schema.routes)
      .set({
        ...changes,
        updatedAt: new Date(),
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.routes.id, update.id));
  }
  async applyDelete(_: string, update: DeleteStoryUpdate) {
    if (update.entity !== this.entityName || !update.id) return;
    await this.db
      .update(schema.routes)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.routes.id, update.id));
  }
  async getById(id: string): Promise<Route | undefined> {
    return this.db.query.routes.findFirst({ where: eq(schema.routes.id, id) });
  }
}
