import type { CreateStoryUpdate } from '@keres/shared';
import { CreateCharacterDataSchema, PartialCharacterSchema } from '@keres/shared';
import type { z } from 'zod';
import { db, type CompatibleDb } from '../../db';
import { characters } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

type CharacterCreateType = z.infer<typeof CreateCharacterDataSchema>;

export class CharacterSyncHandler extends BaseSyncEntityHandler<
  typeof CreateCharacterDataSchema,
  typeof PartialCharacterSchema
> {
  entityName = 'Character';

  constructor() {
    super('id', 'version', CreateCharacterDataSchema, PartialCharacterSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(
    userId: string,
    storyId: string,
    update: CreateStoryUpdate,
    database: CompatibleDb = db,
  ): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CharacterCreateType = this.createSchema.parse(update.data);

    const currentCharacter = await this.findById(update.id!, database);
    if (currentCharacter) {
      throw new Error(`Conflict: Character with ID ${update.id} already exists.`);
    }

    await database.insert(characters).values({
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
