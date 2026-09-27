import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  LocationRelation,
  UpdateStoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

/**
 * Mirrors the server's location relations. The server refuses a second connection of one pair
 * or a second parent of one child (`duplicate`), and the device that made it folds its own row
 * into the first: a relation arriving here is one the server holds, never one to judge.
 */
export class LocationRelationClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'LocationRelation';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error('LocationRelationClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const relationData = update.data as LocationRelation;

    await this.db.insert(schema.locationRelations).values({
      ...relationData,
      id: update.id,
      storyId,
      createdAt: new Date(relationData.createdAt),
      // A create without a timestamp stores "now" instead of crashing on the missing date.
      updatedAt: relationData.updatedAt ? new Date(relationData.updatedAt) : new Date(),
      deletedAt: relationData.deletedAt ? new Date(relationData.deletedAt) : null,
    });
    console.log(`Applied create for LocationRelation ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const localRelation = await this.db.query.locationRelations.findFirst({
      where: eq(schema.locationRelations.id, update.id),
    });

    if (!localRelation) {
      console.warn(`LocationRelation ${update.id} not found locally for update. Skipping.`);
      return;
    }

    const changes = update.changes as Partial<LocationRelation>;

    await this.db
      .update(schema.locationRelations)
      .set({
        ...changes,
        storyId,
        updatedAt: new Date(update.operationTime || new Date()),
        createdAt: changes.createdAt ? new Date(changes.createdAt) : undefined,
        deletedAt: changes.deletedAt ? new Date(changes.deletedAt) : undefined,
      })
      .where(eq(schema.locationRelations.id, update.id));
    console.log(`Applied update for LocationRelation ${update.id}`);
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db
      .update(schema.locationRelations)
      .set({
        storyId,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.locationRelations.id, update.id));
    console.log(`Applied delete for LocationRelation ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<LocationRelation | undefined> {
    const relation = await this.db.query.locationRelations.findFirst({
      where: eq(schema.locationRelations.id, id),
    });
    return relation as LocationRelation | undefined;
  }
}
