import type { SyncStoredEntityFor } from './BaseSyncEntityHandler';
import type { CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CreateChapterAnchorDataSchema, PartialChapterAnchorSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { chapterAnchors, chapters, scenes } from '../../db/schema';
import { BaseSyncEntityHandler, SyncConflictError } from './BaseSyncEntityHandler';

/**
 * Where a container sits on the story's timeline.
 *
 * Every anchor names the container being placed and the start scene it is measured from. The end
 * scene is optional: an open stretch lasts as long as the container's own scenes. A stretch pointing
 * at a deleted scene has no position at all, so it is refused rather than stored.
 */
export class ChapterAnchorSyncHandler extends BaseSyncEntityHandler<
  typeof CreateChapterAnchorDataSchema,
  typeof PartialChapterAnchorSchema
> {
  entityName = 'ChapterAnchor';

  constructor() {
    super('id', 'version', CreateChapterAnchorDataSchema, PartialChapterAnchorSchema, {
      storyIdColumnName: 'storyId',
      isDeletedColumnName: 'isDeleted',
      deletedAtColumnName: 'deletedAt',
    });
  }

  private async assertExists(
    storyId: string,
    label: string,
    id: string | undefined,
    kind: 'chapter' | 'scene',
    database: CompatibleDb = db,
  ): Promise<void> {
    if (!id) return;
    const found =
      kind === 'chapter'
        ? await database.query.chapters.findFirst({
            where: and(
              eq(chapters.id, id),
              eq(chapters.storyId, storyId),
              eq(chapters.isDeleted, false),
            ),
          })
        : await database.query.scenes.findFirst({
            where: and(eq(scenes.id, id), eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
          });
    if (!found) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: ${label} with ID ${id} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate, database: CompatibleDb = db): Promise<void> {
    const data = this.createSchema.parse(update.data);

    await this.assertExists(storyId, 'Container', data.chapterId, 'chapter', database);
    await this.assertExists(storyId, 'Start scene', data.startSceneId, 'scene', database);
    await this.assertExists(storyId, 'End scene', data.endSceneId ?? undefined, 'scene', database);

    await database.insert(chapterAnchors).values({
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
    currentEntity: SyncStoredEntityFor<typeof this.createSchema>,
    database: CompatibleDb = db,
  ): Promise<void> {
    const changes = this.updateSchema.parse(update.changes);

    await this.assertExists(storyId, 'Container', changes.chapterId, 'chapter', database);
    await this.assertExists(storyId, 'Start scene', changes.startSceneId, 'scene', database);
    await this.assertExists(storyId, 'End scene', changes.endSceneId ?? undefined, 'scene', database);

    await super.update(userId, storyId, update, currentEntity, database);
  }
}
