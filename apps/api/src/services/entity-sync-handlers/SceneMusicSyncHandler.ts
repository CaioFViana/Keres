import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type {
  CreateSceneMusicDataType,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { CreateSceneMusicDataSchema, PartialSceneMusicSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { sceneMusic, scenes } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

export class SceneMusicSyncHandler extends BaseSyncEntityHandler<
  typeof CreateSceneMusicDataSchema,
  typeof PartialSceneMusicSchema
> {
  entityName = 'SceneMusic';

  constructor() {
    super('id', 'version', CreateSceneMusicDataSchema, PartialSceneMusicSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  /** The link belongs to a live scene of this story. Its target is not checked: a link outlives it. */
  private async assertSceneAlive(storyId: string, sceneId: string, database: CompatibleDb) {
    const scene = await database.query.scenes.findFirst({
      where: and(eq(scenes.id, sceneId), eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
    });
    if (!scene) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        'The scene this music belongs to is no longer active.',
      );
    }
  }

  async create(_: string, storyId: string, update: CreateStoryUpdate, database: CompatibleDb = db) {
    const data: CreateSceneMusicDataType = this.createSchema.parse(update.data);
    await this.assertSceneAlive(storyId, data.sceneId, database);
    if (await this.findById(update.id!, database)) {
      throw new Error(`Conflict: SceneMusic with ID ${update.id} already exists.`);
    }
    await database.insert(sceneMusic).values({
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
    userId: string,
    storyId: string,
    update: UpdateStoryUpdate,
    current: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ) {
    const changes = update.changes as Record<string, unknown>;
    const next = {
      sceneId: 'sceneId' in changes ? changes.sceneId : current.sceneId,
      songId: 'songId' in changes ? changes.songId : current.songId,
      galleryId: 'galleryId' in changes ? changes.galleryId : current.galleryId,
    };
    if ('sceneId' in changes) {
      await this.assertSceneAlive(storyId, String(next.sceneId), database);
    }
    // Pointing the link at something else sets one target and clears the other in the same change;
    // both at once is ambiguous. Neither is fine: that is a link whose target is gone.
    if (next.songId && next.galleryId) {
      throw new SyncConflictError('validation', 'Music is a song or a gallery medium, not both.');
    }
    await super.update(userId, storyId, update, current, database);
  }

  async delete(
    userId: string,
    storyId: string,
    update: DeleteStoryUpdate,
    current: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ) {
    await super.delete(userId, storyId, update, current, database);
  }
}
