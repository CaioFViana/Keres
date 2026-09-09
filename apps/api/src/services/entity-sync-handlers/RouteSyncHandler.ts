import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreateRouteDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateRouteDataSchema, PartialRouteSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { routes, stories } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class RouteSyncHandler extends BaseSyncEntityHandler<
  typeof CreateRouteDataSchema,
  typeof PartialRouteSchema
> {
  entityName = 'Route';
  constructor() {
    super('id', 'version', CreateRouteDataSchema, PartialRouteSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }
  private async assertBranching(storyId: string, database: CompatibleDb = db) {
    const story = await database.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.isDeleted, false)),
    });
    if (!story || story.type !== 'branching')
      throw new SyncConflictError('validation', 'Routes are only available for branching stories.');
  }
  async create(_: string, storyId: string, update: CreateStoryUpdate, database: CompatibleDb = db) {
    const data: CreateRouteDataType = this.createSchema.parse(update.data);
    await this.assertBranching(storyId, database);
    if (await this.findById(update.id!, database))
      throw new Error(`Conflict: Route with ID ${update.id} already exists.`);
    await database.insert(routes).values({
      id: update.id!,
      storyId,
      name: data.name,
      details: data.details,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
    });
  }
  async update(userId: string, storyId: string, update: UpdateStoryUpdate, current: SyncStoredEntityFor<typeof this.createSchema>, database: CompatibleDb = db) {
    await this.assertBranching(storyId, database);
    await super.update(userId, storyId, update, current, database);
  }
  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, current: SyncStoredEntityFor<typeof this.createSchema>, database: CompatibleDb = db) {
    await this.assertBranching(storyId, database);
    await super.delete(userId, storyId, update, current, database);
  }
}
