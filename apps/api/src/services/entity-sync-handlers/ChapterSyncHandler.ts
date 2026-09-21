import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  ChapterReorderingStoryUpdate,
  CreateStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { ChapterReorderingStoryUpdateSchema, completeReorderProblem } from '@keres/shared';
import type { CreateChapterDataType } from '@keres/shared/';
import { CreateChapterDataSchema, PartialChapterSchema } from '@keres/shared/';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
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

  async create(
    userId: string,
    storyId: string,
    update: CreateStoryUpdate,
    database: CompatibleDb = db,
  ): Promise<void> {
    // Validate incoming data against the create schema
    const validatedData: CreateChapterDataType = this.createSchema.parse(update.data);
    if (validatedData.arcId) {
      const arc = await database.query.storyArcs.findFirst({
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

    const currentChapter = await this.findById(update.id!, database);
    if (currentChapter) {
      throw new Error(`Conflict: Chapter with ID ${update.id} already exists.`);
    }

    await database.insert(chapters).values({
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

  // Override the update method to handle ChapterReorderingStoryUpdate
  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate | ChapterReorderingStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    if (update.type === 'reorder' && update.entity === 'Chapter') {
      const validatedReorderUpdate: ChapterReorderingStoryUpdate =
        ChapterReorderingStoryUpdateSchema.parse(update);

      // Perform version check for the Chapter itself
      this.checkVersionConflict(
        validatedReorderUpdate.version!,
        currentEntity.version,
        validatedReorderUpdate.id!,
      );

      await database.transaction(async (tx) => {
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

        const problem = completeReorderProblem(
          existingScenes.map((scene) => scene.id),
          validatedReorderUpdate.reorderItems,
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
              version: sceneToUpdate.version + 1,
            })
            .where(eq(scenes.id, item.id));
        });

        await Promise.all(updatePromises);

        // 4. Increment Chapter Version
        await tx
          .update(chapters)
          .set({
            updatedAt: new Date(),
            version: currentEntity.version + 1,
          })
          .where(eq(chapters.id, validatedReorderUpdate.id!));
      });
    } else {
      // If it's not a reorder update, delegate to the base class's update method
      await super.update(userId, storyId, update as UpdateStoryUpdate, currentEntity, database);
    }
  }
}
