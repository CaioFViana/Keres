import { CreateSceneDataSchema, CreateSceneDataType, CreateStoryUpdate, DeleteStoryUpdate, PartialSceneSchema, UpdateStoryUpdate } from '@keres/shared';
import { and, eq, not, sql } from 'drizzle-orm';
import { db } from '../../db';
import { chapters, locations, scenes, stories } from '../../db/schema';
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

  private async _handleIsStartFinishFlags(storyId: string, sceneId: string, isStart: boolean | undefined, isFinish: boolean | undefined): Promise<void> {
    if (isStart === true) {
      // Unset isStart for all other scenes in the same story
      await db.update(scenes)
        .set({ isStart: false, updatedAt: new Date(), version: sql`${scenes.version} + 1` })
        .where(and(
          eq(scenes.storyId, storyId),
          eq(scenes.isStart, true),
          not(eq(scenes.id, sceneId))
        ));
    }

    if (isFinish === true) {
      // Unset isFinish for all other scenes in the same story
      await db.update(scenes)
        .set({ isFinish: false, updatedAt: new Date(), version: sql`${scenes.version} + 1` })
        .where(and(
          eq(scenes.storyId, storyId),
          eq(scenes.isFinish, true),
          not(eq(scenes.id, sceneId))
        ));
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
    if (isLinear && (validatedData.isStart || validatedData.isFinish)) {
      await this._handleIsStartFinishFlags(storyId, update.id!, validatedData.isStart, validatedData.isFinish);
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
  }

  async update(userId: string, storyId: string, update: UpdateStoryUpdate, currentEntity: any): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    // If chapterId or locationId are being updated, validate them
    if (validatedChanges.chapterId || validatedChanges.locationId) {
      const newChapterId = validatedChanges.chapterId || currentEntity.chapterId;
      const newLocationId = validatedChanges.locationId || currentEntity.locationId;
      await this.validateRelatedEntities(storyId, newChapterId, newLocationId);
    }

    const isLinear = await this._isStoryLinear(storyId);
    if (isLinear && (validatedChanges.isStart !== undefined || validatedChanges.isFinish !== undefined)) {
      await this._handleIsStartFinishFlags(storyId, update.id!, validatedChanges.isStart, validatedChanges.isFinish);
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
  }

  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, currentEntity: any): Promise<void> {
    // The client is now responsible for creating operations to re-index other scenes.
    // The API's role is simply to mark this specific scene as deleted.
    await super.delete(userId, storyId, update, currentEntity);
  }
}
