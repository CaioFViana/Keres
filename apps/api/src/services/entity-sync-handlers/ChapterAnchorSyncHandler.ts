import type { CreateStoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { CreateChapterAnchorDataSchema, PartialChapterAnchorSchema } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
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
    super(
      'chapterAnchors',
      'id',
      'version',
      CreateChapterAnchorDataSchema,
      PartialChapterAnchorSchema,
      {
        storyIdColumnName: 'storyId',
        isDeletedColumnName: 'isDeleted',
        deletedAtColumnName: 'deletedAt',
      },
    );
  }

  private async assertExists(
    storyId: string,
    label: string,
    id: string | undefined,
    kind: 'chapter' | 'scene',
  ): Promise<void> {
    if (!id) return;
    const found =
      kind === 'chapter'
        ? await db.query.chapters.findFirst({
            where: and(
              eq(chapters.id, id),
              eq(chapters.storyId, storyId),
              eq(chapters.isDeleted, false),
            ),
          })
        : await db.query.scenes.findFirst({
            where: and(eq(scenes.id, id), eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
          });
    if (!found) {
      throw new SyncConflictError(
        'referenced_entity_deleted',
        `Validation Error: ${label} with ID ${id} not found, is deleted, or does not belong to story ${storyId}.`,
      );
    }
  }

  async create(userId: string, storyId: string, update: CreateStoryUpdate): Promise<void> {
    const data = this.createSchema.parse(update.data);

    await this.assertExists(storyId, 'Container', data.chapterId, 'chapter');
    await this.assertExists(storyId, 'Start scene', data.startSceneId, 'scene');
    await this.assertExists(storyId, 'End scene', data.endSceneId ?? undefined, 'scene');

    await db.insert(chapterAnchors).values({
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
    currentEntity: any,
  ): Promise<void> {
    const changes = this.updateSchema.parse(update.changes);

    await this.assertExists(storyId, 'Container', changes.chapterId, 'chapter');
    await this.assertExists(storyId, 'Start scene', changes.startSceneId, 'scene');
    await this.assertExists(storyId, 'End scene', changes.endSceneId ?? undefined, 'scene');

    await super.update(userId, storyId, update, currentEntity);
  }
}
