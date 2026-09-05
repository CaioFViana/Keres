import type {
  ChapterReorderingStoryUpdate,
  CreateStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { ChapterReorderingStoryUpdateSchema, reorderIndicesProblem } from '@keres/shared';
import type { CreateChapterDataType } from '@keres/shared/';
import { CreateChapterDataSchema, PartialChapterSchema } from '@keres/shared/';
import { and, eq } from 'drizzle-orm'; // Import necessary Drizzle-orm functions
import { db } from '../../db';
import { chapters, scenes, storyArcs } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class ChapterSyncHandler extends BaseSyncEntityHandler<
  typeof CreateChapterDataSchema,
  typeof PartialChapterSchema
> {
  entityName = 'Chapter';

  constructor() {
    super('id', 'version', CreateChapterDataSchema, PartialChapterSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateChapterDataType = this.createSchema.parse(update.data);
    if (validatedData.arcId) {
      const arc = await db.query.storyArcs.findFirst({
        where: and(
          eq(storyArcs.id, validatedData.arcId),
          eq(storyArcs.storyId, storyId),
          eq(storyArcs.isDeleted, false),
        ),
      });
      if (!arc) {
        throw new SyncConflictError(
          'validation',
          `Arc with ID ${validatedData.arcId} does not belong to story ${storyId}.`,
        );
      }
    }

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

  // Override the update method to handle ChapterReorderingStoryUpdate
  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate | ChapterReorderingStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    if (update.type === 'reorder' && update.entity === 'Chapter') {
      // Refined check
      const validatedReorderUpdate: ChapterReorderingStoryUpdate =
        ChapterReorderingStoryUpdateSchema.parse(update); // Corrected schema and type

      // Perform version check for the Chapter itself
      this.checkVersionConflict(
        validatedReorderUpdate.version!,
        currentEntity[this.versionColumnName],
        validatedReorderUpdate.id!,
      );

      await db.transaction(async (tx) => {
        // 1. Validate reorderItems against actual scenes in the chapter
        const existingScenes = await tx.query.scenes.findMany({
          where: and(
            eq(scenes.chapterId, validatedReorderUpdate.id!),
            eq(scenes.storyId, storyId),
            eq(scenes.isDeleted, false),
          ),
          columns: {
            id: true,
            index: true,
            version: true,
          },
        });

        const existingSceneIds = new Set(existingScenes.map((s) => s.id));
        const reorderSceneIds = new Set(validatedReorderUpdate.reorderItems.map((item) => item.id));

        // Ensure all reorder items correspond to existing scenes in this chapter
        if (
          reorderSceneIds.size !== existingSceneIds.size ||
          ![...reorderSceneIds].every((id) => existingSceneIds.has(id))
        ) {
          throw new SyncConflictError(
            'validation',
            'Validation Error: Reorder items do not match current scenes in chapter or contain invalid scene IDs.',
          );
        }

        // The rule (contiguous 1..N, no repeats) lives in `@keres/shared`: the client builds the list with
        // `buildReorderItems` from it, and this handler enforces the same thing.
        const problem = reorderIndicesProblem(
          validatedReorderUpdate.reorderItems.map((item) => item.newIndex),
        );
        if (problem) {
          throw new SyncConflictError('validation', problem);
        }

        // 2. Batch Update Scene Indices
        const updatePromises = validatedReorderUpdate.reorderItems.map((item) => {
          const sceneToUpdate = existingScenes.find((s) => s.id === item.id);
          if (!sceneToUpdate) {
            // This case should ideally be caught by the earlier validation, but as a safeguard
            throw new Error(`Scene with ID ${item.id} not found in chapter during batch update.`);
          }
          // Increment scene version, and update index and updatedAt
          return tx
            .update(scenes)
            .set({
              index: item.newIndex,
              updatedAt: new Date(),
              version: sceneToUpdate.version + 1, // Increment individual scene version
            })
            .where(eq(scenes.id, item.id));
        });

        await Promise.all(updatePromises);

        // 4. Increment Chapter Version
        await tx
          .update(chapters)
          .set({
            updatedAt: new Date(),
            version: currentEntity.version + 1, // Increment chapter version
          })
          .where(eq(chapters.id, validatedReorderUpdate.id!));
      });
    } else {
      // If it's not a reorder update, delegate to the base class's update method
      await super.update(userId, storyId, update as UpdateStoryUpdate, currentEntity);
    }
  }
}
