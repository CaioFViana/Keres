import { z } from 'zod';
import { CreateStoryDataSchema, PartialStorySchema } from '../../schemas/StorySchemas'; // Import schemas
import { CreateStoryUpdate } from '../../schemas/SyncSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

type CreateStoryDataType = z.infer<typeof CreateStoryDataSchema>;

export class StorySyncHandler extends BaseSyncEntityHandler<typeof CreateStoryDataSchema, typeof PartialStorySchema> {
  entityName = 'Story';

  constructor() {
    super(
      'stories', // Pass table name as string
      'id',
      'version',
      CreateStoryDataSchema, // Pass create schema
      PartialStorySchema, // Pass update schema
      {
        userIdColumnName: 'userId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Prevent creation of new Story entities via the sync engine.
    // Story creation should happen through a dedicated API route.
    throw new Error('Story creation is not allowed via the sync engine. Please use the dedicated story creation API.');

    // The following code would be for actual creation if it were allowed:
    /*
    const validatedData: CreateStoryDataType = this.createSchema.parse(update.data);

    const currentStory = await this.findById(update.id!);
    if (currentStory) {
      throw new Error(`Conflict: Story with ID ${update.id} already exists.`);
    }

    await db.insert(stories).values({
      id: update.id!, // Override with the ID from the update
      userId: userId, // Ensure userId is set from the authenticated user
      ...validatedData, // Spread the validated data
      version: 1, // Ensure version starts at 1 for new creations
      createdAt: new Date(), // Ensure createdAt is set
      updatedAt: new Date(), // Ensure updatedAt is set
      isDeleted: false, // Ensure isDeleted is false
      deletedAt: null, // Ensure deletedAt is null,
    });
    */
  }
}
