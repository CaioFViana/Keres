import {
  CreateStoryDataSchema,
  CreateStoryUpdate,
  PartialStorySchema,
  StoryReorderingStoryUpdate,
  StoryReorderingStoryUpdateSchema,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { chapters, stories } from '../../db/schema';
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
  }

  // Override the update method to handle StoryReorderingStoryUpdate
  async update(userId: string, storyId: string, update: UpdateStoryUpdate | StoryReorderingStoryUpdate, currentEntity: any): Promise<void> {
    if (update.type === 'reorder' && update.entity === 'Story') {
      const validatedReorderUpdate: StoryReorderingStoryUpdate = StoryReorderingStoryUpdateSchema.parse(update);

      // Perform version check for the Story itself
      this.checkVersionConflict(validatedReorderUpdate.version!, currentEntity[this.versionColumnName], validatedReorderUpdate.id!);

      await db.transaction(async (tx) => {
        // 1. Validate reorderItems against actual chapters in the story
        const existingChapters = await tx.query.chapters.findMany({
          where: and(
            eq(chapters.storyId, validatedReorderUpdate.id!),
            eq(chapters.isDeleted, false)
          ),
          columns: {
            id: true,
            index: true,
            version: true,
          }
        });

        const existingChapterIds = new Set(existingChapters.map(c => c.id));
        const reorderChapterIds = new Set(validatedReorderUpdate.reorderItems.map(item => item.id));

        // Ensure all reorder items correspond to existing chapters in this story
        if (reorderChapterIds.size !== existingChapterIds.size || ![...reorderChapterIds].every(id => existingChapterIds.has(id))) {
            throw new Error('Validation Error: Reorder items do not match current chapters in story or contain invalid chapter IDs.');
        }

        // Ensure new indices are unique and sequential (optional, but good for data integrity)
        const newIndices = validatedReorderUpdate.reorderItems.map(item => item.newIndex);
        if (new Set(newIndices).size !== newIndices.length) {
            throw new Error('Validation Error: Duplicate newIndex values found in reorder items.');
        }
        // Assuming indices start from 1 and are sequential without gaps.
        if (Math.min(...newIndices) !== 1 || Math.max(...newIndices) !== newIndices.length) {
             throw new Error('Validation Error: New indices must be sequential starting from 1 without gaps.');
        }

        // 2. Batch Update Chapter Indices
        const updatePromises = validatedReorderUpdate.reorderItems.map(item => {
          const chapterToUpdate = existingChapters.find(c => c.id === item.id);
          if (!chapterToUpdate) {
            // This case should ideally be caught by the earlier validation, but as a safeguard
            throw new Error(`Chapter with ID ${item.id} not found in story during batch update.`);
          }
          // Increment chapter version, and update index and updatedAt
          return tx.update(chapters)
            .set({
              index: item.newIndex,
              updatedAt: new Date(),
              version: chapterToUpdate.version + 1, // Increment individual chapter version
            })
            .where(eq(chapters.id, item.id));
        });

        await Promise.all(updatePromises);

        // 3. Increment Story Version
        await tx.update(stories)
          .set({
            updatedAt: new Date(),
            version: currentEntity.version + 1, // Increment story version
          })
          .where(eq(stories.id, validatedReorderUpdate.id!));
      });

    } else {
      // If it's not a story reorder update, delegate to the base class's update method
      await super.update(userId, storyId, update as UpdateStoryUpdate, currentEntity);
    }
  }
}
