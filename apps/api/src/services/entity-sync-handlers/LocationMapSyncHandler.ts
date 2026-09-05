import type { CreateLocationMapDataType, CreateStoryUpdate } from '@keres/shared';
import { CreateLocationMapDataSchema, PartialLocationMapSchema } from '@keres/shared';
import { db } from '../../db';
import { locationMaps } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

/**
 * Location maps arriving from a client.
 *
 * `content` is validated as a document. A map may reference a gallery image whose medium is not
 * on this device yet - the map stays valid and the image simply does not render until it is.
 */
export class LocationMapSyncHandler extends BaseSyncEntityHandler<
  typeof CreateLocationMapDataSchema,
  typeof PartialLocationMapSchema
> {
  entityName = 'LocationMap';

  constructor() {
    super('id', 'version', CreateLocationMapDataSchema, PartialLocationMapSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateLocationMapDataType = this.createSchema.parse(update.data);

    const existing = await this.findById(update.id!);
    if (existing) {
      throw new Error(`Conflict: LocationMap with ID ${update.id} already exists.`);
    }

    await db.insert(locationMaps).values({
      id: update.id!,
      storyId,
      ...validatedData,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }
}
