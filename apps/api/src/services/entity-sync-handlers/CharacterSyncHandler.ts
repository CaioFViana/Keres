import { CreateStoryUpdate } from '@keres/shared';
import { z } from 'zod';
import { db } from '../../db';
import { characters } from '../../db/schema';
import { CreateCharacterDataSchema, PartialCharacterSchema } from '../../schemas/CharacterSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

type CharacterCreateType = z.infer<typeof CreateCharacterDataSchema>;

export class CharacterSyncHandler extends BaseSyncEntityHandler<typeof CreateCharacterDataSchema, typeof PartialCharacterSchema> {
  entityName = 'Character';

  constructor() {
    super(
      'characters', // Pass table name as string
      'id',
      'version',
      CreateCharacterDataSchema,
      PartialCharacterSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CharacterCreateType = this.createSchema.parse(update.data);

    const currentCharacter = await this.findById(update.id!);
    if (currentCharacter) {
      throw new Error(`Conflict: Character with ID ${update.id} already exists.`);
    }

    await db.insert(characters).values({
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
