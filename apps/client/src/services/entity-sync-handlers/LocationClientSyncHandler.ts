import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { Location } from '@keres/shared/entities/Location'; // Import the Location entity interface
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { ClientSyncEntityHandler } from './ClientSyncEntityHandler';

export class LocationClientSyncHandler implements ClientSyncEntityHandler {
  entityName: string = 'Location';
  private dbInstance: AppDrizzleClient | null = null;

  setDb(dbInstance: AppDrizzleClient): void {
    this.dbInstance = dbInstance;
  }

  private get db(): AppDrizzleClient {
    if (!this.dbInstance) {
      throw new Error('LocationClientSyncHandler: Drizzle client (db) not set.');
    }
    return this.dbInstance;
  }

  async applyCreate(storyId: string, update: CreateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for create operation on ${this.entityName}`);
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
    console.log(`Applied create for Location ${update.id} in story ${storyId}`);
  }

  async applyUpdate(storyId: string, update: UpdateStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id || !update.changes) {
      console.error(`Missing ID or changes for update operation on ${this.entityName}`);
      return;
    }

    const locationChanges = update.changes as Partial<Location>;

    await this.db.update(schema.locations)
      .set({
        ...locationChanges,
        storyId: storyId,
        updatedAt: new Date(), // Always update updatedAt on change
        // Ensure date fields are correctly converted if they come as strings
        createdAt: locationChanges.createdAt ? new Date(locationChanges.createdAt) : undefined,
        deletedAt: locationChanges.deletedAt ? new Date(locationChanges.deletedAt) : undefined,
      })
      .where(eq(schema.locations.id, update.id));
    console.log(`Applied update for Location ${update.id}`);
  }

  async applyDelete(storyId: string, update: DeleteStoryUpdate): Promise<void> {
    if (update.entity !== this.entityName) return;

    if (!update.id) {
      console.error(`Missing ID for delete operation on ${this.entityName} in story ${storyId}`);
      return;
    }

    await this.db.update(schema.locations)
      .set({
        storyId: storyId,
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.locations.id, update.id));
    console.log(`Applied delete for Location ${update.id} in story ${storyId}`);
  }

  async getById(id: string): Promise<Location | undefined> {
    const location = await this.db.query.locations.findFirst({
      where: eq(schema.locations.id, id),
    });
    return location;
  }
}
