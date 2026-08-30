import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  LocationMapRowType,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/** Applies LocationMap documents received from the server to the local SQLite store. */
export class LocationMapClientSyncHandler implements ClientSyncEntityHandler {
  entityName = 'LocationMap';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('LocationMapClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;
    const map = update.data as LocationMapRowType;
    await this.db.insert(schema.locationMaps).values({
      ...map,
      id: update.id,
      storyId,
      createdAt: new Date(map.createdAt),
      updatedAt: new Date(map.updatedAt),
      deletedAt: map.deletedAt ? new Date(map.deletedAt) : null,
    });
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id || !update.changes) return;
    const local = await this.db.query.locationMaps.findFirst({
      where: eq(schema.locationMaps.id, update.id),
    });
    if (!local) {
      console.warn(`LocationMap ${update.id} not found locally for update. Skipping.`);
      return;
    }

    const changes = update.changes as Partial<LocationMapRowType>;
    await this.db
      .update(schema.locationMaps)
      .set({
        ...changes,
        storyId,
        updatedAt: new Date(update.operationTime || new Date()),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.locationMaps.id, update.id));
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName || !update.id) return;
    await this.db
      .update(schema.locationMaps)
      .set({ storyId, isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.locationMaps.id, update.id));
  }

  async getById(id: string): Promise<LocationMapRowType | undefined> {
    return this.db.query.locationMaps.findFirst({
      where: eq(schema.locationMaps.id, id),
    }) as Promise<LocationMapRowType | undefined>;
  }
}
