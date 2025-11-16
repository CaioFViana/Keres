import { characters } from '../../db/schema';
import { CreateStoryUpdate } from '../../schemas/SyncSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';
import { db } from '../../db';
import { CharacterSchema, PartialCharacterSchema } from '../../schemas/CharacterSchemas'; // Import schemas
import { z } from 'zod';

type CharacterCreateType = z.infer<typeof CharacterSchema>;

export class CharacterSyncHandler extends BaseSyncEntityHandler<typeof CharacterSchema, typeof PartialCharacterSchema> {
  entityName = 'Character';

  constructor() {
    super(
      'characters', // Pass table name as string
      'id',
      'version',
      CharacterSchema, // Pass create schema
      PartialCharacterSchema, // Pass update schema
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
      storyId: storyId, // Ensure storyId is set
      name: validatedData.name,
      gender: validatedData.gender,
      race: validatedData.race,
      subrace: validatedData.subrace,
      description: validatedData.description,
      personality: validatedData.personality,
      motivation: validatedData.motivation,
      qualities: validatedData.qualities,
      weaknesses: validatedData.weaknesses,
      biography: validatedData.biography,
      plannedTimeline: validatedData.plannedTimeline,
      isFavorite: validatedData.isFavorite,
      extraNotes: validatedData.extraNotes,
      version: 1, // Ensure version starts at 1 for new creations
      createdAt: new Date(), // Ensure createdAt is set
      updatedAt: new Date(), // Ensure updatedAt is set
      isDeleted: false, // Ensure isDeleted is false
      deletedAt: null, // Ensure deletedAt is null
    });
  }
}
