import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type { CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import type { CreateChapterDataType } from '@keres/shared/';
import { CreateChapterDataSchema, PartialChapterSchema } from '@keres/shared/';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { chapters, storyArcs } from '../../db/schema';
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
      await this.assertArcInStory(validatedData.arcId, storyId, database);
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

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    // Moving a chapter to another arc is held to the same check as creating it in one.
    const arcId = update.changes?.arcId;
    if (typeof arcId === 'string' && arcId.length > 0) {
      await this.assertArcInStory(arcId, storyId, database);
    }
    await super.update(userId, storyId, update, currentEntity, database);
  }

  private async assertArcInStory(
    arcId: string,
    storyId: string,
    database: CompatibleDb,
  ): Promise<void> {
    const arc = await database.query.storyArcs.findFirst({
      where: and(
        eq(storyArcs.id, arcId),
        eq(storyArcs.storyId, storyId),
        eq(storyArcs.isDeleted, false),
      ),
    });
    if (!arc) {
      // A missing arc is a reference, like any other: it may be deleted, or still on its way.
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Arc with ID ${arcId} does not belong to story ${storyId}.`,
      );
    }
  }
}
