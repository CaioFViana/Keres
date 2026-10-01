import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreateSceneDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateSceneDataSchema, PartialSceneSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { chapters, locations, scenes, storyCalendars } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class SceneSyncHandler extends BaseSyncEntityHandler<
  typeof CreateSceneDataSchema,
  typeof PartialSceneSchema
> {
  entityName = 'Scene';

  constructor() {
    super('id', 'version', CreateSceneDataSchema, PartialSceneSchema, {
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
    database: CompatibleDb = db,
  ): Promise<void> {
    if (chapterId) {
      const chapter = await database.query.chapters.findFirst({
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

    const location = await database.query.locations.findFirst({
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

  private async validateOverrideCalendar(
    storyId: string,
    calendarId: string | null | undefined,
    database: CompatibleDb = db,
  ) {
    if (!calendarId) return;
    const calendar = await database.query.storyCalendars.findFirst({
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

  // No side effects on other scenes: a linear story's single start/finish is kept by the client,
  // which records the flag each other scene loses as its own edit (SceneService). Every row an
  // operation changes has to be logged, or no other device ever learns of it.

  async create(
    userId: string,
    storyId: string,
    update: CreateStoryUpdate,
    database: CompatibleDb = db,
  ): Promise<void> {
    const validatedData: CreateSceneDataType = this.createSchema.parse(update.data);

    const currentScene = await this.findById(update.id!, database);
    if (currentScene) {
      throw new Error(`Conflict: Scene with ID ${update.id} already exists.`);
    }

    await this.validateRelatedEntities(
      storyId,
      validatedData.chapterId,
      validatedData.locationId,
      database,
    );
    await this.validateOverrideCalendar(
      storyId,
      validatedData.calendarDateOverrideCalendarId,
      database,
    );

    await database.insert(scenes).values({
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
    const validatedChanges = this.updateSchema.parse(update.changes);

    if (validatedChanges.chapterId !== undefined || validatedChanges.locationId !== undefined) {
      // `??` not `||`: clearing chapter or place sends `null`, which `||` would replace with the
      // previous value and skip the validation this branch exists for.
      const newChapterId =
        validatedChanges.chapterId !== undefined
          ? validatedChanges.chapterId
          : currentEntity.chapterId;
      const newLocationId = validatedChanges.locationId ?? currentEntity.locationId;
      await this.validateRelatedEntities(storyId, newChapterId, newLocationId, database);
    }
    if (validatedChanges.calendarDateOverrideCalendarId !== undefined) {
      await this.validateOverrideCalendar(
        storyId,
        validatedChanges.calendarDateOverrideCalendarId,
        database,
      );
    }

    // Delegated to the base class instead of a raw version-matched UPDATE reimplemented here:
    // that reimplementation had no `checkVersionConflict`, no `deleted_on_server` check, and
    // used server time instead of the client's `operationTime` - a concurrent edit landed here
    // with no error and no conflict reported, just silently dropped (same bug already found
    // and fixed in NoteSyncHandler/WorldRuleSyncHandler, just never cleaned up in this sibling).
    await super.update(userId, storyId, update, currentEntity, database);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    // The client is now responsible for creating operations to re-index other scenes.
    // The API's role is simply to mark this specific scene as deleted.
    await super.delete(userId, storyId, update, currentEntity, database);
  }
}
