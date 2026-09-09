import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreatePlotSceneDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreatePlotSceneDataSchema, PartialPlotSceneSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { plots, plotScenes, scenes, stories } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class PlotSceneSyncHandler extends BaseSyncEntityHandler<
  typeof CreatePlotSceneDataSchema,
  typeof PartialPlotSceneSchema
> {
  entityName = 'PlotScene';
  constructor() {
    super('id', 'version', CreatePlotSceneDataSchema, PartialPlotSceneSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }
  private async validate(storyId: string, plotId: string, sceneId: string, database: CompatibleDb = db) {
    const [story, plot, scene] = await Promise.all([
      database.query.stories.findFirst({
        where: and(eq(stories.id, storyId), eq(stories.isDeleted, false)),
      }),
      database.query.plots.findFirst({
        where: and(eq(plots.id, plotId), eq(plots.storyId, storyId), eq(plots.isDeleted, false)),
      }),
      database.query.scenes.findFirst({
        where: and(
          eq(scenes.id, sceneId),
          eq(scenes.storyId, storyId),
          eq(scenes.isDeleted, false),
        ),
      }),
    ]);
    if (!story)
      throw new SyncConflictError('referenced_entity_deleted', 'Story is no longer active.');
    if (story.type !== 'linear')
      throw new SyncConflictError('validation', 'Plots are only available for linear stories.');
    if (!plot || !scene)
      throw new SyncConflictError(
        'referenced_entity_deleted',
        'Plot and scene must belong to the active story.',
      );
  }
  async create(_: string, storyId: string, update: CreateStoryUpdate, database: CompatibleDb = db): Promise<void> {
    const data: CreatePlotSceneDataType = this.createSchema.parse(update.data);
    await this.validate(storyId, data.plotId, data.sceneId, database);
    const duplicate = await database.query.plotScenes.findFirst({
      where: and(
        eq(plotScenes.storyId, storyId),
        eq(plotScenes.plotId, data.plotId),
        eq(plotScenes.sceneId, data.sceneId),
        eq(plotScenes.isDeleted, false),
      ),
    });
    if (duplicate || (await this.findById(update.id!, database)))
      throw new Error('Conflict: this scene is already part of the plot.');
    await database.insert(plotScenes).values({
      id: update.id!,
      storyId,
      plotId: data.plotId,
      sceneId: data.sceneId,
      note: data.note,
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
    current: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    const changes = this.updateSchema.parse(update.changes);
    await this.validate(
      storyId,
      changes.plotId ?? current.plotId,
      changes.sceneId ?? current.sceneId, database);
    await super.update(userId, storyId, update, current, database);
  }
  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    current: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    await this.validate(storyId, current.plotId, current.sceneId, database);
    await super.delete(userId, storyId, update, current, database);
  }
}
