import type {
  CreatePlotDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreatePlotDataSchema, PartialPlotSchema } from '@keres/shared';
import { db } from '../../db';
import { plots } from '../../db/schema';
import { BaseSyncEntityHandler } from './BaseSyncEntityHandler';

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
  async create(_: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const data: CreatePlotDataType = this.createSchema.parse(update.data);
    if (await this.findById(update.id!))
      throw new Error(`Conflict: Plot with ID ${update.id} already exists.`);
    await db.insert(plots).values({
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
    await super.update(userId, storyId, update, currentEntity);
  }
  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    currentEntity: any,
  ): Promise<void> {
    await super.delete(userId, storyId, update, currentEntity);
  }
}
