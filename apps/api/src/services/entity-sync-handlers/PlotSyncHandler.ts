import type {
  CreatePlotDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate} from '@keres/shared';
import {
  CreatePlotDataSchema,
  PartialPlotSchema
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { plots, stories } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class PlotSyncHandler extends BaseSyncEntityHandler<
  typeof CreatePlotDataSchema,
  typeof PartialPlotSchema
> {
  entityName = 'Plot';
  constructor() {
    super('plots', 'id', 'version', CreatePlotDataSchema, PartialPlotSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }
  private async assertLinear(storyId: string) {
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.isDeleted, false)),
    });
    if (!story || story.type !== 'linear')
      throw new SyncConflictError('validation', 'Plots are only available for linear stories.');
  }
  async create(_: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const data: CreatePlotDataType = this.createSchema.parse(update.data);
    await this.assertLinear(storyId);
    if (await this.findById(update.id!))
      throw new Error(`Conflict: Plot with ID ${update.id} already exists.`);
    await db
      .insert(plots)
      .values({
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
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    await this.assertLinear(storyId);
    await super.update(userId, storyId, update, currentEntity);
  }
  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    await this.assertLinear(storyId);
    await super.delete(userId, storyId, update, currentEntity);
  }
}
