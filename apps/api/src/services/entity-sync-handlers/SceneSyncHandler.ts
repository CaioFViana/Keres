import type {
  CreateSceneDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateSceneDataSchema, PartialSceneSchema } from '@keres/shared';
import { and, eq, not, sql } from 'drizzle-orm';
import { db } from '../../db';
import { chapters, locations, scenes, stories, storyCalendars } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class SceneSyncHandler extends BaseSyncEntityHandler<
  typeof CreateSceneDataSchema,
  typeof PartialSceneSchema
> {
  entityName = 'Scene';

  constructor() {
    super('scenes', 'id', 'version', CreateSceneDataSchema, PartialSceneSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  /**
   * `locationId` is nullable: a scene may happen nowhere in particular.
   *
   * Absent is accepted; **named but missing is not** - the second means the package or the client
   * is referring to a location this story does not have, which is the failure this check exists
   * for. Collapsing the two would let a broken reference through as "no place".
   */
  private async validateRelatedEntities(
    storyId: string,
    chapterId: string | null | undefined,
    locationId: string | null | undefined,
  ): Promise<void> {
    if (chapterId) {
      const chapter = await db.query.chapters.findFirst({
        where: and(
          eq(chapters.id, chapterId),
          eq(chapters.storyId, storyId),
          eq(chapters.isDeleted, false),
        ),
      });
      if (!chapter) {
        throw new SyncConflictError(
          'referenced_entity_deleted',
          `Validation Error: Chapter with ID ${chapterId} not found, is deleted, or does not belong to story ${storyId}.`,
        );
      }
    }

    if (!locationId) return;

    const location = await db.query.locations.findFirst({
      where: and(
        eq(locations.id, locationId),
        eq(locations.storyId, storyId),
        eq(locations.isDeleted, false),
      ),
    });
    if (!location) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Location with ID ${locationId} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }
  }

  private async validateOverrideCalendar(storyId: string, calendarId: string | null | undefined) {
    if (!calendarId) return;
    const calendar = await db.query.storyCalendars.findFirst({
      where: and(
        eq(storyCalendars.id, calendarId),
        eq(storyCalendars.storyId, storyId),
        eq(storyCalendars.isDeleted, false),
      ),
    });
    if (!calendar) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: Calendar with ID ${calendarId} does not belong to story ${storyId}.`,
      );
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

  private async _handleIsStartFinishFlags(
    storyId: string,
    sceneId: string,
    isStart: boolean | undefined,
    isFinish: boolean | undefined,
  ): Promise<void> {
    if (isStart === true) {
      // Unset isStart for all other scenes in the same story
      await db
        .update(scenes)
        .set({ isStart: false, updatedAt: new Date(), version: sql`${scenes.version} + 1` })
        .where(
          and(eq(scenes.storyId, storyId), eq(scenes.isStart, true), not(eq(scenes.id, sceneId))),
        );
    }

    if (isFinish === true) {
      // Unset isFinish for all other scenes in the same story
      await db
        .update(scenes)
        .set({ isFinish: false, updatedAt: new Date(), version: sql`${scenes.version} + 1` })
        .where(
          and(eq(scenes.storyId, storyId), eq(scenes.isFinish, true), not(eq(scenes.id, sceneId))),
        );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const validatedData: CreateSceneDataType = this.createSchema.parse(update.data);

    const currentScene = await this.findById(update.id!);
    if (currentScene) {
      throw new Error(`Conflict: Scene with ID ${update.id} already exists.`);
    }

    await this.validateRelatedEntities(storyId, validatedData.chapterId, validatedData.locationId);
    await this.validateOverrideCalendar(storyId, validatedData.calendarDateOverrideCalendarId);

    const isLinear = await this._isStoryLinear(storyId);
    if (isLinear && (validatedData.isStart || validatedData.isFinish)) {
      await this._handleIsStartFinishFlags(
        storyId,
        update.id!,
        validatedData.isStart,
        validatedData.isFinish,
      );
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

  async update(
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    const validatedChanges = this.updateSchema.parse(update.changes);

    if (validatedChanges.chapterId !== undefined || validatedChanges.locationId !== undefined) {
      // `??` not `||`: clearing chapter or place sends `null`, which `||` would replace with the
      // previous value and skip the validation this branch exists for.
      const newChapterId =
        validatedChanges.chapterId !== undefined
          ? validatedChanges.chapterId
          : currentEntity.chapterId;
      const newLocationId = validatedChanges.locationId ?? currentEntity.locationId;
      await this.validateRelatedEntities(storyId, newChapterId, newLocationId);
    }
    if (validatedChanges.calendarDateOverrideCalendarId !== undefined) {
      await this.validateOverrideCalendar(storyId, validatedChanges.calendarDateOverrideCalendarId);
    }

    const isLinear = await this._isStoryLinear(storyId);
    if (
      isLinear &&
      (validatedChanges.isStart !== undefined || validatedChanges.isFinish !== undefined)
    ) {
      await this._handleIsStartFinishFlags(
        storyId,
        update.id!,
        validatedChanges.isStart,
        validatedChanges.isFinish,
      );
    }

    // Delegated to the base class instead of a raw version-matched UPDATE reimplemented here:
    // that reimplementation had no `checkVersionConflict`, no `deleted_on_server` check, and
    // used server time instead of the client's `operationTime` - a concurrent edit landed here
    // with no error and no conflict reported, just silently dropped (same bug already found
    // and fixed in NoteSyncHandler/WorldRuleSyncHandler, just never cleaned up in this sibling).
    // As a bonus, throwing on conflict now also rolls back the isStart/isFinish flag-flip above
    // via the same transaction, instead of leaving other scenes' flags cleared while this
    // scene's own edit silently failed to apply.
    await super.update(userId, storyId, update, currentEntity);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    // The client is now responsible for creating operations to re-index other scenes.
    // The API's role is simply to mark this specific scene as deleted.
    await super.delete(userId, storyId, update, currentEntity);
  }
}
