import type { CreateLocationDataType, CreateStoryUpdate } from '@keres/shared';
import { CreateLocationDataSchema, PartialLocationSchema } from '@keres/shared';
import { db } from '../../db';
import { locations } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class LocationSyncHandler extends BaseSyncEntityHandler<
  typeof CreateLocationDataSchema,
  typeof PartialLocationSchema
> {
  entityName = 'Location';

  constructor() {
    super('id', 'version', CreateLocationDataSchema, PartialLocationSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateLocationDataType = this.createSchema.parse(update.data);

    const currentLocation = await this.findById(update.id!);
    if (currentLocation) {
      throw new Error(`Conflict: Location with ID ${update.id} already exists.`);
    }

    await db.insert(locations).values({
      id: update.id!, // Explicitly provide ID from update, as it's a ULID from client
      storyId: storyId, // Ensure storyId is set from the context
      ...validatedData, // Spread the validated data from the client
      version: 1, // Ensure version starts at 1 for new creations
      createdAt: new Date(), // Ensure createdAt is set
      updatedAt: new Date(), // Ensure updatedAt is set
      isDeleted: false, // Ensure isDeleted is false
      deletedAt: null, // Ensure deletedAt is null
    });
  }
}
