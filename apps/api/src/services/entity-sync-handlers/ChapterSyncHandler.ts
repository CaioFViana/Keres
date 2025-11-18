import { db } from '../../db';
import { chapters } from '../../db/schema';
import { CreateChapterDataSchema, CreateChapterDataType, PartialChapterSchema } from '../../schemas/ChapterSchemas';
import { CreateStoryUpdate } from '../../schemas/SyncSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class ChapterSyncHandler extends BaseSyncEntityHandler<typeof CreateChapterDataSchema, typeof PartialChapterSchema> {
  entityName = 'Chapter';

  constructor() {
    super(
      'chapters', // Pass table name as string
      'id',
      'version',
      CreateChapterDataSchema,
      PartialChapterSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateChapterDataType = this.createSchema.parse(update.data);

    const currentChapter = await this.findById(update.id!);
    if (currentChapter) {
      throw new Error(`Conflict: Chapter with ID ${update.id} already exists.`);
    }

    await db.insert(chapters).values({
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
