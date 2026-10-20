import type { SyncStoredEntityFor, SyncWriteContext } from './BaseSyncEntityHandler';
import type {
  CreateScenePageDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateScenePageDataSchema, PartialScenePageSchema } from '@keres/shared';
import { db } from '@/db';
import { scenePages } from '@/db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class ScenePageSyncHandler extends BaseSyncEntityHandler<
  typeof CreateScenePageDataSchema,
  typeof PartialScenePageSchema
> {
  entityName = 'ScenePage';

  constructor() {
    super('id', 'version', CreateScenePageDataSchema, PartialScenePageSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  async create(update: CreateStoryUpdate, { storyId, database = db }: SyncWriteContext) {
    const data: CreateScenePageDataType = this.createSchema.parse(update.data);
    await this.assertSceneAlive(storyId, data.sceneId, database, 'page');
    if (await this.findById(update.id!, database)) {
      throw new Error(`Conflict: ScenePage with ID ${update.id} already exists.`);
    }
    await database.insert(scenePages).values({
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

  async update(
    update: UpdateStoryUpdate,
    current: SyncStoredEntityFor<typeof this.createSchema>,
    ctx: SyncWriteContext,
  ) {
    const { storyId, database = db } = ctx;
    const changes = update.changes as Record<string, unknown>;
    const next = {
      sceneId: 'sceneId' in changes ? changes.sceneId : current.sceneId,
      sketchId: 'sketchId' in changes ? changes.sketchId : current.sketchId,
      galleryId: 'galleryId' in changes ? changes.galleryId : current.galleryId,
    };
    if ('sceneId' in changes) {
      await this.assertSceneAlive(storyId, String(next.sceneId), database, 'page');
    }
    // Replacing the image sets one and clears the other in the same change; both at once is
    // ambiguous. Neither is fine: that is a page whose image is gone.
    if (next.sketchId && next.galleryId) {
      throw new SyncConflictError(
        'validation',
        'A page shows a sketch or a gallery medium, not both.',
      );
    }
    await super.update(update, current, ctx);
  }

  async delete(
    update: DeleteStoryUpdate,
    current: SyncStoredEntityFor<typeof this.createSchema>,
    ctx: SyncWriteContext,
  ) {
    await super.delete(update, current, ctx);
  }
}
