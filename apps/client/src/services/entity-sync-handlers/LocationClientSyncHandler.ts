import type { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import type { Location } from '@keres/shared/entities/narrative/Location'; // Import the Location entity interface
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '@/src/db';
import * as schema from '@/src/db/schema';
import type { ClientSyncEntityHandler } from './ClientSyncEntityHandler';
import { logger } from '@/src/utils/logging/logger';

export class LocationClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Location';
  private dbInstance: AppDrizzleClient | AppDrizzleTransaction | null = null;

  setDb(dbInstance: AppDrizzleClient | AppDrizzleTransaction): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient | AppDrizzleTransaction {
    if (!this.dbInstance) {
      throw new Error('LocationClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(update: CreateStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for create operation on ${this.entityName}`);
      return;
    }

    const locationData = update.data as Location;

    await this.db.insert(schema.locations).values({
      ...locationData,
      id: update.id,
      storyId: storyId,
      createdAt: new Date(locationData.createdAt),
      updatedAt: new Date(locationData.updatedAt),
      deletedAt: locationData.deletedAt ? new Date(locationData.deletedAt) : null,
    });
    logger.debug(`Applied create for Location ${update.id} in story ${storyId}`);
  }

  async applyUpdate(update: UpdateStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      logger.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const locationChanges = update.changes as Partial<Location>;

    await this.db
      .update(schema.locations)
      .set({
        ...locationChanges,
        storyId: storyId,
        updatedAt: new Date(), // Always update updatedAt on change
        // Ensure date fields are correctly converted if they come as strings
        createdAt: locationChanges.createdAt ? new Date(locationChanges.createdAt) : undefined,
        deletedAt: locationChanges.deletedAt ? new Date(locationChanges.deletedAt) : undefined,
      })
      .where(eq(schema.locations.id, update.id));
    logger.debug(`Applied update for Location ${update.id}`);
  }

  async applyDelete(update: DeleteStoryUpdate, storyId: string): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      logger.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db
      .update(schema.locations)
      .set({
        storyId: storyId,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.locations.id, update.id));
    logger.debug(`Applied delete for Location ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<Location | undefined> {
    const location = await this.db.query.locations.findFirst({
      where: eq(schema.locations.id, id),
    });
    return location;
  }
}
