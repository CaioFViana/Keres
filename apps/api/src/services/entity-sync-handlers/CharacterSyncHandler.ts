import { characters } from '../../db/schema';
import { CreateStoryUpdate } from '../../schemas/SyncSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';
import { db } from '../../db';

export class CharacterSyncHandler extends BaseSyncEntityHandler {
  entityName = 'Character';

  constructor() {
    super(
      'characters', // Pass table name as string
      'id',
      'version',
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const currentCharacter = await this.findById(update.id!);
    if (currentCharacter) {
      throw new Error(`Conflict: Character with ID ${update.id} already exists.`);
    }

    await db.insert(characters).values({
      id: update.id!,
      storyId: storyId,
      name: update.data.name,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
