import type { SyncStoredEntityFor, SyncWriteContext } from './BaseSyncEntityHandler';
import type {
  CreateRouteDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateRouteDataSchema, PartialRouteSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '@/db';
import { routes, stories } from '@/db/schema';
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
  async create(update: CreateStoryUpdate, { storyId, database = db }: SyncWriteContext) {
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
  async update(
    update: UpdateStoryUpdate,
    current: SyncStoredEntityFor<typeof this.createSchema>,
    ctx: SyncWriteContext,
  ) {
    const { storyId, database = db } = ctx;
    await this.assertBranching(storyId, database);
    await super.update(update, current, ctx);
  }
  async delete(
    update: DeleteStoryUpdate,
    current: SyncStoredEntityFor<typeof this.createSchema>,
    ctx: SyncWriteContext,
  ) {
    const { storyId, database = db } = ctx;
    await this.assertBranching(storyId, database);
    await super.delete(update, current, ctx);
  }
}
