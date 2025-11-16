import { stories } from '../../db/schema';
import { CreateStoryUpdate } from '../../schemas/SyncSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';
import { db } from '../../db';
import { StorySchema, PartialStorySchema, StoryCreateInputSchema } from '../../schemas/StorySchemas'; // Import schemas
import { z } from 'zod';

type StoryCreateInputType = z.infer<typeof StoryCreateInputSchema>;

export class StorySyncHandler extends BaseSyncEntityHandler<typeof StoryCreateInputSchema, typeof PartialStorySchema> {
  entityName = 'Story';

  constructor() {
    super(
      'stories', // Pass table name as string
      'id',
      'version',
      StoryCreateInputSchema, // Pass create schema
      PartialStorySchema, // Pass update schema
      {
        userIdColumnName: 'userId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: StoryCreateInputType = this.createSchema.parse(update.data);

    const currentStory = await this.findById(update.id!);
    if (currentStory) {
      throw new Error(`Conflict: Story with ID ${update.id} already exists.`);
    }

    await db.insert(stories).values({
      id: update.id!, // Override with the ID from the update
      userId: userId, // Ensure userId is set from the authenticated user
      title: validatedData.title,
      type: validatedData.type,
      description: validatedData.description,
      genre: validatedData.genre,
      language: validatedData.language,
      isFavorite: validatedData.isFavorite,
      extraNotes: validatedData.extraNotes,
      theme: validatedData.theme,
      version: 1, // Ensure version starts at 1 for new creations
      createdAt: new Date(), // Ensure createdAt is set
      updatedAt: new Date(), // Ensure updatedAt is set
      isDeleted: false, // Ensure isDeleted is false
      deletedAt: null, // Ensure deletedAt is null
    });
  }
}
