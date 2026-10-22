import type { CreateLocationDataType, CreateStoryUpdate } from '@keres/shared';
import { CreateLocationDataSchema, PartialLocationSchema } from '@keres/shared';
import { db } from '@/db';
import { locations } from '@/db/schema';
import { BaseSyncEntityHandler, type SyncWriteContext } from './BaseSyncEntityHandler';

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

  async create(update: CreateStoryUpdate, ctx: SyncWriteContext): Promise<void> {
    const { storyId, database = db } = ctx;
    // Validate incoming data against the create schema
    const validatedData: CreateLocationDataType = this.createSchema.parse(update.data);

    const currentLocation = await this.findById(update.id!, database);
    if (currentLocation) {
      throw new Error(`Conflict: Location with ID ${update.id} already exists.`);
    }

    await database.insert(locations).values({
      id: update.id!,
      storyId: storyId,
      ...validatedData,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }
}
