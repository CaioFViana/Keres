import type { CreateSongDataType, CreateStoryUpdate } from '@keres/shared';
import { CreateSongDataSchema, PartialSongSchema } from '@keres/shared';
import { db } from '@/db';
import { songs } from '@/db/schema';
import { BaseSyncEntityHandler, type SyncWriteContext } from './BaseSyncEntityHandler';

/**
 * Songs arriving from a client. The text fields are validated against the limits real songs fit in;
 * a change names the fields it touches, so lyrics and melody edited on two devices do not collide.
 */
export class SongSyncHandler extends BaseSyncEntityHandler<
  typeof CreateSongDataSchema,
  typeof PartialSongSchema
> {
  entityName = 'Song';

  constructor() {
    super('id', 'version', CreateSongDataSchema, PartialSongSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(update: CreateStoryUpdate, ctx: SyncWriteContext): Promise<void> {
    const { storyId, database = db } = ctx;
    const data: CreateSongDataType = this.createSchema.parse(update.data);

    if (await this.findById(update.id!, database)) {
      throw new Error(`Conflict: Song with ID ${update.id} already exists.`);
    }

    await database.insert(songs).values({
      id: update.id!,
      storyId,
      ...data,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }
}
