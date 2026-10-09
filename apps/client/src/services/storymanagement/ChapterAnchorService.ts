import type { ScenePosition } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { ChapterAnchorInsert, ChapterAnchorSelect } from '../../db/schema';
import { chapterAnchors } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import { softDeleteRowSync } from './softDelete';

/**
 * When a container happens, said against the story's own timeline.
 *
 * One row is one stretch. The start is always a moment on the spine. The end is optional: without
 * it, the container lasts as long as the scenes it contains. A container that pauses and resumes has
 * more than one *closed* stretch - an open stretch cannot share a container with another.
 *
 * There is deliberately no ordering rule between the stretches of one container: `order` is which
 * stretch it is, and the timeline works out where they land. A writer who states them out of
 * sequence gets a correct drawing rather than a refusal.
 */

export interface ChapterAnchorService {
  getAnchorsForStory(storyId: string): Promise<ChapterAnchorSelect[]>;
  getAnchorsForChapter(chapterId: string): Promise<ChapterAnchorSelect[]>;
  createAnchor(
    currentUserId: string,
    data: Create<ChapterAnchorInsert>,
  ): Promise<ChapterAnchorSelect>;
  updateAnchor(
    currentUserId: string,
    anchorId: string,
    changes: Partial<{
      startSceneId: string;
      startPosition: ScenePosition;
      startOffset: number | null;
      startOffsetUnit: string | null;
      endSceneId: string | null;
      endPosition: ScenePosition | null;
      endOffset: number | null;
      endOffsetUnit: string | null;
    }>,
  ): Promise<ChapterAnchorSelect>;
  deleteAnchor(currentUserId: string, anchorId: string): Promise<void>;
  /** The next free stretch number for a container, so a second stretch never collides. */
  nextOrderFor(storyId: string, chapterId: string): Promise<number>;
}

export const createChapterAnchorService = (db: AppDrizzleClient): ChapterAnchorService => {
  const serverService = createServerService(db);

  const liveOf = (chapterId: string) =>
    and(eq(chapterAnchors.chapterId, chapterId), eq(chapterAnchors.isDeleted, false));

  const assertOpenStretchRule = async (
    chapterId: string,
    endSceneId: string | null | undefined,
    excludeId?: string,
  ) => {
    const live = await db.select().from(chapterAnchors).where(liveOf(chapterId)).all();
    const others = live.filter((row) => row.id !== excludeId);
    const hasOpen = others.some((row) => !row.endSceneId);
    if (!endSceneId) {
      if (others.length > 0) {
        throw new Error('An open stretch must be the only stretch on its container.');
      }
      return;
    }
    if (hasOpen) {
      throw new Error('An open stretch cannot share a container with another stretch.');
    }
  };

  return {
    async getAnchorsForStory(storyId) {
      return db
        .select()
        .from(chapterAnchors)
        .where(and(eq(chapterAnchors.storyId, storyId), eq(chapterAnchors.isDeleted, false)))
        .orderBy(asc(chapterAnchors.chapterId), asc(chapterAnchors.order))
        .all();
    },

    async getAnchorsForChapter(chapterId) {
      return db
        .select()
        .from(chapterAnchors)
        .where(liveOf(chapterId))
        .orderBy(asc(chapterAnchors.order))
        .all();
    },

    async nextOrderFor(storyId, chapterId) {
      const existing = await db
        .select({ order: chapterAnchors.order })
        .from(chapterAnchors)
        .where(and(eq(chapterAnchors.storyId, storyId), liveOf(chapterId)))
        .all();
      return existing.length > 0 ? Math.max(...existing.map((row) => row.order)) + 1 : 1;
    },

    async createAnchor(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);
      await assertOpenStretchRule(data.chapterId, data.endSceneId ?? null);

      const anchor = prepareNewEntityData<ChapterAnchorInsert>(data);
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        anchor.storyId,
        currentUserId,
      );
      const result = await runLocalWrite(db, anchor.storyId, () => {
        const inserted = db.insert(chapterAnchors).values(anchor).returning().get();
        recordLocalOperationSync(
          db,
          anchor.storyId,
          userIdToLog,
          'create',
          'ChapterAnchor',
          anchor.id,
          { ...inserted },
        );
        return inserted;
      });
      entityEventEmitter.emit('chapter_anchor_changed', anchor.storyId, anchor.id);
      return result;
    },

    async updateAnchor(currentUserId, anchorId, changes) {
      const original = await db.query.chapterAnchors.findFirst({
        where: eq(chapterAnchors.id, anchorId),
      });
      if (!original) throw new Error(`ChapterAnchor with ID ${anchorId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);
      if ('endSceneId' in changes) {
        await assertOpenStretchRule(original.chapterId, changes.endSceneId, original.id);
      }

      const changed = getChangedFields(original, { ...original, ...changes });
      delete changed.version;
      delete changed.updatedAt;
      if (Object.keys(changed).length === 0) return original;

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        original.storyId,
        currentUserId,
      );
      const updated = await runLocalWrite(db, original.storyId, () => {
        db.update(chapterAnchors)
          .set({ ...changes, updatedAt: new Date(), version: sql`${chapterAnchors.version} + 1` })
          .where(eq(chapterAnchors.id, anchorId))
          .run();
        const row = db.select().from(chapterAnchors).where(eq(chapterAnchors.id, anchorId)).get();
        if (!row) throw new Error(`Failed to retrieve updated ChapterAnchor ${anchorId}.`);
        recordLocalOperationSync(
          db,
          row.storyId,
          userIdToLog,
          'update',
          'ChapterAnchor',
          anchorId,
          getChangedFields(original, row),
        );
        return row;
      });
      entityEventEmitter.emit('chapter_anchor_changed', updated.storyId, anchorId);
      return updated;
    },

    async deleteAnchor(currentUserId, anchorId) {
      const anchor = await db.query.chapterAnchors.findFirst({
        where: eq(chapterAnchors.id, anchorId),
      });
      if (!anchor) {
        console.warn(`Attempted to delete non-existent ChapterAnchor ${anchorId}.`);
        return;
      }
      await assertStoryIsWritable(db, anchor.storyId);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        anchor.storyId,
        currentUserId,
      );
      const updated = await runLocalWrite(db, anchor.storyId, () => {
        const deleted = softDeleteRowSync(
          db,
          chapterAnchors,
          'ChapterAnchor',
          anchorId,
          userIdToLog,
        );
        return deleted;
      });
      entityEventEmitter.emit('chapter_anchor_changed', updated.storyId, anchorId);
    },
  };
};
