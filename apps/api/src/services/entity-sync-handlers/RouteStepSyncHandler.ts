import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreateRouteStepDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateRouteStepDataSchema, PartialRouteStepSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { choices, routeSteps, routes, scenes } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class RouteStepSyncHandler extends BaseSyncEntityHandler<
  typeof CreateRouteStepDataSchema,
  typeof PartialRouteStepSchema
> {
  entityName = 'RouteStep';
  constructor() {
    super('id', 'version', CreateRouteStepDataSchema, PartialRouteStepSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }
  private async validate(
    storyId: string,
    routeId: string,
    sceneId: string,
    choiceId: string | null,
    database: CompatibleDb = db,
  ) {
    const [route, scene, choice] = await Promise.all([
      database.query.routes.findFirst({
        where: and(
          eq(routes.id, routeId),
          eq(routes.storyId, storyId),
          eq(routes.isDeleted, false),
        ),
      }),
      database.query.scenes.findFirst({
        where: and(
          eq(scenes.id, sceneId),
          eq(scenes.storyId, storyId),
          eq(scenes.isDeleted, false),
        ),
      }),
      choiceId
        ? database.query.choices.findFirst({
            where: and(
              eq(choices.id, choiceId),
              eq(choices.storyId, storyId),
              eq(choices.isDeleted, false),
            ),
          })
        : Promise.resolve(undefined),
    ]);
    if (!route || !scene || (choiceId && !choice))
      throw new SyncConflictError(
        'referenced_entity_deleted',
        'Route, scene or selected choice is no longer active.',
      );
    if (choice && choice.sceneId !== sceneId)
      throw new SyncConflictError('validation', 'A RouteStep choice must leave the step scene.');
  }
  async create(_: string, storyId: string, update: CreateStoryUpdate, database: CompatibleDb = db) {
    const data: CreateRouteStepDataType = this.createSchema.parse(update.data);
    await this.validate(storyId, data.routeId, data.sceneId, data.selectedChoiceId, database);
    if (await this.findById(update.id!, database))
      throw new Error(`Conflict: RouteStep with ID ${update.id} already exists.`);
    await database.insert(routeSteps).values({
      id: update.id!,
      storyId,
      ...data,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }
  async update(userId: string, storyId: string, update: UpdateStoryUpdate, current: SyncStoredEntityFor<typeof this.createSchema>, database: CompatibleDb = db) {
    const changes = this.updateSchema.parse(update.changes);
    await this.validate(
      storyId,
      changes.routeId ?? current.routeId,
      changes.sceneId ?? current.sceneId,
      changes.selectedChoiceId ?? current.selectedChoiceId, database);
    await super.update(userId, storyId, update, current, database);
  }
  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, current: SyncStoredEntityFor<typeof this.createSchema>, database: CompatibleDb = db) {
    await super.delete(userId, storyId, update, current, database);
  }
}
