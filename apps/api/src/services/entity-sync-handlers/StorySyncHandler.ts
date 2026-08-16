import {
  CreateStoryDataSchema,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  PartialStorySchema,
  StoryReorderingStoryUpdate,
  StoryReorderingStoryUpdateSchema,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { chapters, galleries, stories, storySchemaFields } from '../../db/schema';
import { mediaStorageService } from '../MediaStorageService';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class StorySyncHandler extends BaseSyncEntityHandler<
  typeof CreateStoryDataSchema,
  typeof PartialStorySchema
> {
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
      },
    );
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: z.infer<typeof CreateStoryDataSchema> = this.createSchema.parse(
      update.data,
    );

    // Validate operationTime is not in the future
    const clientOperationTime = new Date(update.operationTime!);
    if (clientOperationTime.getTime() > new Date().getTime() + 1000) {
      // Allow 1 second clock skew
      throw new Error(`Operation time ${update.operationTime} cannot be in the future.`);
    }

    await db.insert(stories).values({
      id: update.id!,
      userId: userId, // Set by server
      createdAt: clientOperationTime, // Set from operationTime
      updatedAt: clientOperationTime, // Set from operationTime
      version: 1,
      isDeleted: false,
      deletedAt: null,
      ...validatedData, // Spread validated data
    });
  }

  // Override the update method to handle StoryReorderingStoryUpdate
  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate | StoryReorderingStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    if (update.type === 'reorder' && update.entity === 'Story') {
      const validatedReorderUpdate: StoryReorderingStoryUpdate =
        StoryReorderingStoryUpdateSchema.parse(update);

      // Perform version check for the Story itself
      this.checkVersionConflict(
        validatedReorderUpdate.version!,
        currentEntity[this.versionColumnName],
        validatedReorderUpdate.id!,
      );

      if (validatedReorderUpdate.reorderTarget === 'StorySchemaField') {
        if (!validatedReorderUpdate.schemaEntityType) {
          throw new Error('Validation Error: Attribute reorders require a schema entity type.');
        }
        const existingFields = await db.query.storySchemaFields.findMany({
          where: and(
            eq(storySchemaFields.storyId, validatedReorderUpdate.id!),
            eq(storySchemaFields.entityType, validatedReorderUpdate.schemaEntityType),
            eq(storySchemaFields.isDeleted, false),
          ),
          columns: { id: true, version: true },
        });
        const fieldIds = new Set(existingFields.map((field) => field.id));
        const reorderIds = new Set(validatedReorderUpdate.reorderItems.map((item) => item.id));
        const indices = validatedReorderUpdate.reorderItems.map((item) => item.newIndex);
        if (
          reorderIds.size !== fieldIds.size ||
          ![...reorderIds].every((id) => fieldIds.has(id)) ||
          Math.min(...indices) !== 1 ||
          Math.max(...indices) !== indices.length
        ) {
          throw new Error(
            'Validation Error: Attribute reorder items must match the selected type.',
          );
        }

        await db.transaction(async (tx) => {
          await Promise.all(
            validatedReorderUpdate.reorderItems.map((item) => {
              const field = existingFields.find((candidate) => candidate.id === item.id)!;
              return tx
                .update(storySchemaFields)
                .set({
                  order: item.newIndex - 1,
                  updatedAt: new Date(),
                  version: field.version + 1,
                })
                .where(eq(storySchemaFields.id, item.id));
            }),
          );
          await tx
            .update(stories)
            .set({ updatedAt: new Date(), version: currentEntity.version + 1 })
            .where(eq(stories.id, validatedReorderUpdate.id!));
        });
        return;
      }

      await db.transaction(async (tx) => {
        // 1. Validate reorderItems against actual chapters in the story
        const existingChapters = await tx.query.chapters.findMany({
          where: and(
            eq(chapters.storyId, validatedReorderUpdate.id!),
            eq(chapters.isDeleted, false),
          ),
          columns: {
            id: true,
            index: true,
            version: true,
          },
        });

        const existingChapterIds = new Set(existingChapters.map((c) => c.id));
        const reorderChapterIds = new Set(
          validatedReorderUpdate.reorderItems.map((item) => item.id),
        );

        // Ensure all reorder items correspond to existing chapters in this story
        if (
          reorderChapterIds.size !== existingChapterIds.size ||
          ![...reorderChapterIds].every((id) => existingChapterIds.has(id))
        ) {
          throw new Error(
            'Validation Error: Reorder items do not match current chapters in story or contain invalid chapter IDs.',
          );
        }

        // Ensure new indices are unique and sequential (optional, but good for data integrity)
        const newIndices = validatedReorderUpdate.reorderItems.map((item) => item.newIndex);
        if (new Set(newIndices).size !== newIndices.length) {
          throw new Error('Validation Error: Duplicate newIndex values found in reorder items.');
        }
        // Assuming indices start from 1 and are sequential without gaps.
        if (Math.min(...newIndices) !== 1 || Math.max(...newIndices) !== newIndices.length) {
          throw new Error(
            'Validation Error: New indices must be sequential starting from 1 without gaps.',
          );
        }

        // 2. Batch Update Chapter Indices
        const updatePromises = validatedReorderUpdate.reorderItems.map((item) => {
          const chapterToUpdate = existingChapters.find((c) => c.id === item.id);
          if (!chapterToUpdate) {
            // This case should ideally be caught by the earlier validation, but as a safeguard
            throw new Error(`Chapter with ID ${item.id} not found in story during batch update.`);
          }
          // Increment chapter version, and update index and updatedAt
          return tx
            .update(chapters)
            .set({
              index: item.newIndex,
              updatedAt: new Date(),
              version: chapterToUpdate.version + 1, // Increment individual chapter version
            })
            .where(eq(chapters.id, item.id));
        });

        await Promise.all(updatePromises);

        // 3. Increment Story Version
        await tx
          .update(stories)
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

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);

    // O tombstone acima é só da história - ele não se propaga para as Galleries dela (cada
    // entidade sincroniza o próprio tombstone independentemente), então sem esta varredura
    // todo hash que essa história já referenciou ficaria órfão no disco para sempre assim
    // que a história sumisse da visão de todo mundo.
    const referencedHashes = await db
      .selectDistinct({ hash: galleries.hash })
      .from(galleries)
      .where(eq(galleries.storyId, update.id!));

    for (const { hash } of referencedHashes) {
      await mediaStorageService.deleteBlobIfUnreferenced(hash);
    }
  }
}
