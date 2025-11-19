import { and, eq, inArray, not, sql, SQL } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../../db';
import { chapters, choices, locations, scenes, stories } from '../../db/schema';
import { CreateSceneDataSchema, CreateSceneDataType, PartialSceneSchema } from '../../schemas/SceneSchemas';
import { CreateStoryUpdate, DeleteStoryUpdate, UpdateStoryUpdate } from '../../schemas/SyncSchemas';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

export class SceneSyncHandler extends BaseSyncEntityHandler<typeof CreateSceneDataSchema, typeof PartialSceneSchema> {
  entityName = 'Scene';

  constructor() {
    super(
      'scenes',
      'id',
      'version',
      CreateSceneDataSchema,
      PartialSceneSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      }
    );
  }

  private async validateRelatedEntities(storyId: string, chapterId: string, locationId: string): Promise<void> {
    const chapter = await db.query.chapters.findFirst({
      where: and(
        eq(chapters.id, chapterId),
        eq(chapters.storyId, storyId),
        eq(chapters.isDeleted, false)
      ),
    });
    if (!chapter) {
      throw new Error(`Validation Error: Chapter with ID ${chapterId} not found, is deleted, or does not belong to story ${storyId}.`);
    }

    const location = await db.query.locations.findFirst({
      where: and(
        eq(locations.id, locationId),
        eq(locations.storyId, storyId),
        eq(locations.isDeleted, false)
      ),
    });
    if (!location) {
      throw new Error(`Validation Error: Location with ID ${locationId} not found, is deleted, or does not belong to story ${storyId}.`);
    }
  }

  private async _isStoryLinear(storyId: string): Promise<boolean> {
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: {
        type: true,
      },
    });
    return story?.type === 'linear';
  }

  private async _shiftSceneIndexes(storyId: string, chapterId: string, startIndex: number, shiftAmount: 1 | -1, sceneToExcludeId?: string): Promise<void> {
    let whereConditions: (SQL<unknown> | undefined)[] = [
        eq(scenes.chapterId, chapterId),
        eq(scenes.storyId, storyId),
        eq(scenes.isDeleted, false)
    ];

    if (shiftAmount === 1) { // Making space (e.g., insert at startIndex): shift scenes >= startIndex up
        whereConditions.push(sql`${scenes.index} >= ${startIndex}`);
    } else { // Closing gap (e.g., delete at startIndex): shift scenes > startIndex down
        whereConditions.push(sql`${scenes.index} > ${startIndex}`);
    }

    if (sceneToExcludeId) {
        whereConditions.push(not(eq(scenes.id, sceneToExcludeId)));
    }

    await db.update(scenes)
        .set({
            index: sql`${scenes.index} + ${shiftAmount}`,
            updatedAt: new Date(),
            version: sql`${scenes.version} + 1`
        })
        .where(and(...whereConditions));
  }

  private async recreateImplicitChoicesForChapter(storyId: string, chapterId: string): Promise<void> {
    const chapterScenes = await db.query.scenes.findMany({
      where: and(
        eq(scenes.chapterId, chapterId),
        eq(scenes.isDeleted, false),
        eq(scenes.storyId, storyId)
      ),
      orderBy: scenes.index,
    });

    const chapterSceneIds = chapterScenes.map(s => s.id);

    await db.delete(choices).where(and(
      eq(choices.storyId, storyId),
      eq(choices.isImplicit, true),
      chapterSceneIds.length > 0 ? inArray(choices.sceneId, chapterSceneIds) : undefined
    ));

    const newImplicitChoices = [];
    for (let i = 0; i < chapterScenes.length - 1; i++) {
      const currentScene = chapterScenes[i];
      const nextScene = chapterScenes[i + 1];
      newImplicitChoices.push({
        id: ulid(),
        storyId: storyId,
        sceneId: currentScene.id,
        nextSceneId: nextScene.id,
        text: 'Auto Generated For Linear.',
        isImplicit: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        deletedAt: null,
      });
    }

    if (newImplicitChoices.length > 0) {
      await db.insert(choices).values(newImplicitChoices);
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateSceneDataType = this.createSchema.parse(update.data);

    const currentScene = await this.findById(update.id!);
    if (currentScene) {
      throw new Error(`Conflict: Scene with ID ${update.id} already exists.`);
    }

    await this.validateRelatedEntities(storyId, validatedData.chapterId, validatedData.locationId);

    const isLinear = await this._isStoryLinear(storyId);
    if (isLinear) {
        await this._shiftSceneIndexes(storyId, validatedData.chapterId, validatedData.index, 1);
    }

    await db.insert(scenes).values({
      id: update.id!,
      storyId: storyId,
      ...validatedData,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });

    if (isLinear) {
      await this.recreateImplicitChoicesForChapter(storyId, validatedData.chapterId);
    }
  }

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    const oldChapterId = currentEntity.chapterId;
    const oldIndex = currentEntity.index;
    const oldSceneId = currentEntity.id;

    // Declare newChapterId and newIndex at the top level of the method
    let newChapterId = oldChapterId; // Initialize with old value
    let newIndex = oldIndex;         // Initialize with old value

    // If chapterId or locationId are being updated, validate them
    if (validatedChanges.chapterId || validatedChanges.locationId) {
      newChapterId = validatedChanges.chapterId || oldChapterId; // Assign, not redeclare
      const newLocationId = validatedChanges.locationId || currentEntity.locationId;
      await this.validateRelatedEntities(storyId, newChapterId, newLocationId);
    }

    const isLinear = await this._isStoryLinear(storyId);

    if (isLinear && (validatedChanges.chapterId !== undefined || validatedChanges.index !== undefined)) {
        newChapterId = validatedChanges.chapterId || oldChapterId; // Re-assign if chapterId changed
        newIndex = validatedChanges.index !== undefined ? validatedChanges.index : oldIndex; // Re-assign if index changed

        if (newChapterId !== oldChapterId) {
            // Scene moved to a different chapter
            await this._shiftSceneIndexes(storyId, oldChapterId, oldIndex, -1, oldSceneId); // Close gap in old chapter
            await this._shiftSceneIndexes(storyId, newChapterId, newIndex, 1, oldSceneId); // Open space in new chapter
        } else if (newIndex !== oldIndex) {
            // Scene moved within the same chapter
            if (newIndex < oldIndex) {
              // Moving scene to an earlier index: shift scenes between newIndex and oldIndex-1 upwards (+1)
              await db.update(scenes)
                .set({ index: sql`${scenes.index} + 1`, updatedAt: new Date(), version: sql`${scenes.version} + 1` })
                .where(and(
                  eq(scenes.chapterId, newChapterId),
                  eq(scenes.storyId, storyId),
                  eq(scenes.isDeleted, false),
                  sql`${scenes.index} >= ${newIndex}`,
                  sql`${scenes.index} < ${oldIndex}`,
                  not(eq(scenes.id, oldSceneId))
                ));
            } else { // newIndex > oldIndex
              // Moving scene to a later index: shift scenes between oldIndex+1 and newIndex downwards (-1)
              await db.update(scenes)
                .set({ index: sql`${scenes.index} - 1`, updatedAt: new Date(), version: sql`${scenes.version} + 1` })
                .where(and(
                  eq(scenes.chapterId, newChapterId),
                  eq(scenes.storyId, storyId),
                  eq(scenes.isDeleted, false),
                  sql`${scenes.index} > ${oldIndex}`,
                  sql`${scenes.index} <= ${newIndex}`,
                  not(eq(scenes.id, oldSceneId))
                ));
            }
        }
    }

    await db.update(scenes)
      .set({
        ...validatedChanges,
        updatedAt: new Date(),
        version: currentEntity.version + 1,
      })
      .where(and(
        eq(scenes.id, update.id!),
        eq(scenes.version, currentEntity.version)
      ));

    if (isLinear && (validatedChanges.chapterId !== undefined || validatedChanges.index !== undefined)) {
      if (validatedChanges.chapterId !== undefined && validatedChanges.chapterId !== oldChapterId) {
          await this.recreateImplicitChoicesForChapter(storyId, oldChapterId);
          await this.recreateImplicitChoicesForChapter(storyId, newChapterId);
      } else {
          await this.recreateImplicitChoicesForChapter(storyId, newChapterId);
      }
    } else if (isLinear) {
        await this.recreateImplicitChoicesForChapter(storyId, oldChapterId);
    }
  }

  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void> {
    const oldChapterId = currentEntity.chapterId;
    const oldIndex = currentEntity.index;

    await super.delete(userId, storyId, update, currentEntity);

    const isLinear = await this._isStoryLinear(storyId);
    if (isLinear) {
      await this._shiftSceneIndexes(storyId, oldChapterId, oldIndex, -1, currentEntity.id);
      await this.recreateImplicitChoicesForChapter(storyId, oldChapterId);
    }
  }
}
