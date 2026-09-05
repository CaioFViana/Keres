import type {
  CreateRouteDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateRouteDataSchema, PartialRouteSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
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
  private async assertBranching(storyId: string) {
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.isDeleted, false)),
    });
    if (!story || story.type !== 'branching')
      throw new SyncConflictError('validation', 'Routes are only available for branching stories.');
  }
  async create(_: string, storyId: string, update: CreateStoryUpdate) {
    const data: CreateRouteDataType = this.createSchema.parse(update.data);
    await this.assertBranching(storyId);
    if (await this.findById(update.id!))
      throw new Error(`Conflict: Route with ID ${update.id} already exists.`);
    await db.insert(routes).values({
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
  async update(userId: string, storyId: string, update: UpdateStoryUpdate, current: any) {
    await this.assertBranching(storyId);
    await super.update(userId, storyId, update, current);
  }
  async delete(userId: string, storyId: string, update: DeleteStoryUpdate, current: any) {
    await this.assertBranching(storyId);
    await super.delete(userId, storyId, update, current);
  }
}
