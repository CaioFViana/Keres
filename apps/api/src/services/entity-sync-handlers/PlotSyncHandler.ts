import type { SyncStoredEntityFor, SyncWriteContext } from './BaseSyncEntityHandler';
import type {
  CreatePlotDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreatePlotDataSchema, PartialPlotSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '@/db';
import { plots, stories } from '@/db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class PlotSyncHandler extends BaseSyncEntityHandler<
  typeof CreatePlotDataSchema,
  typeof PartialPlotSchema
> {
  entityName = 'Plot';
  constructor() {
    super('id', 'version', CreatePlotDataSchema, PartialPlotSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }
  /** Plots are a linear-story feature; stale offline writes must not recreate them after conversion. */
  private async assertLinear(storyId: string, database: CompatibleDb = db): Promise<void> {
    const story = await database.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.isDeleted, false)),
      columns: { type: true },
    });
    if (!story || story.type !== 'linear') {
      throw new SyncConflictError('validation', 'Plots are only available for linear stories.');
    }
  }
  async create(
    update: CreateStoryUpdate,
    { storyId, database = db }: SyncWriteContext,
  ): Promise<void> {
    const data: CreatePlotDataType = this.createSchema.parse(update.data);
    await this.assertLinear(storyId, database);
    if (await this.findById(update.id!, database))
      throw new Error(`Conflict: Plot with ID ${update.id} already exists.`);
    await database.insert(plots).values({
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
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    ctx: SyncWriteContext,
  ): Promise<void> {
    const { storyId, database = db } = ctx;
    await this.assertLinear(storyId, database);
    await super.update(update, currentEntity, ctx);
  }
  async delete(
    update: DeleteStoryUpdate,
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    ctx: SyncWriteContext,
  ): Promise<void> {
    const { storyId, database = db } = ctx;
    await this.assertLinear(storyId, database);
    await super.delete(update, currentEntity, ctx);
  }
}
