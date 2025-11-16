import { stories } from '../../db/schema';
import { CreateStoryUpdate } from '../../schemas/SyncSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';
import { db } from '../../db';

export class StorySyncHandler extends BaseSyncEntityHandler {
  entityName = 'Story';

  constructor() {
    super(
      'stories', // Pass table name as string
      'id',
      'version',
      {
        userIdColumnName: 'userId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const currentStory = await this.findById(update.id!);
    if (currentStory) {
      throw new Error(`Conflict: Story with ID ${update.id} already exists.`);
    }

    await db.insert(stories).values({
      id: update.id!,
      userId: userId,
      title: update.data.title,
      type: update.data.type,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
