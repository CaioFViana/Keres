import type { ScenePageFit } from '@keres/shared';
import { compareRanked, rankBetween } from '@keres/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { ScenePageInsert, ScenePageSelect } from '../../db/schema';
import { scenePages, scenes } from '../../db/schema';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';

/** The one image of a page: a Sketch of the story, or a medium of its Gallery. */
export type ScenePageMedia = { sketchId: string } | { galleryId: string };

export interface ScenePageService {
  /** A scene's live pages, in the order of their ranks. */
  getPagesForScene(sceneId: string): Promise<ScenePageSelect[]>;
  /** Every live page of the story's live scenes, each scene's in order. */
  getPagesForStory(storyId: string): Promise<ScenePageSelect[]>;
  getById(pageId: string): Promise<ScenePageSelect | undefined>;
  /** Adds a page at the end of the scene's pages (or at `position`, counted from 0). */
  createPage(
    currentUserId: string,
    data: {
      storyId: string;
      sceneId: string;
      media: ScenePageMedia;
      fit?: ScenePageFit;
      text?: string | null;
      position?: number;
    },
  ): Promise<ScenePageSelect>;
  updatePage(
    currentUserId: string,
    pageId: string,
    changes: Partial<{ text: string | null; fit: ScenePageFit }>,
  ): Promise<ScenePageSelect>;
  /** Puts another image in the page's place (also the way out of "media removed"). */
  replaceMedia(
    currentUserId: string,
    pageId: string,
    media: ScenePageMedia,
  ): Promise<ScenePageSelect>;
  /** Moves a page to a place among its scene's pages (counted from 0); only its own rank changes. */
  movePage(currentUserId: string, pageId: string, toPosition: number): Promise<ScenePageSelect>;
  deletePage(currentUserId: string, pageId: string): Promise<void>;
}

function mediaColumns(media: ScenePageMedia) {
  return 'sketchId' in media
    ? { sketchId: media.sketchId, galleryId: null }
    : { sketchId: null, galleryId: media.galleryId };
}

export const createScenePageService = (db: AppDrizzleClient): ScenePageService => {
  const serverService = createServerService(db);
  const userIdFor = (currentUserId: string, storyId: string) =>
    getUserIdForOperation(db, serverService, storyId, currentUserId);

  const livePagesOfScene = (sceneId: string) =>
    db
      .select()
      .from(scenePages)
      .where(and(eq(scenePages.sceneId, sceneId), eq(scenePages.isDeleted, false)))
      .all()
      .sort(compareRanked);

  return {
    async getPagesForScene(sceneId) {
      return livePagesOfScene(sceneId);
    },

    async getPagesForStory(storyId) {
      const liveScenes = db
        .select({ id: scenes.id })
        .from(scenes)
        .where(and(eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)))
        .all();
      if (liveScenes.length === 0) return [];
      const sceneIds = new Set(liveScenes.map((scene) => scene.id));
      return db
        .select()
        .from(scenePages)
        .where(and(eq(scenePages.storyId, storyId), eq(scenePages.isDeleted, false)))
        .all()
        .filter((page) => sceneIds.has(page.sceneId))
        .sort((a, b) =>
          a.sceneId === b.sceneId ? compareRanked(a, b) : a.sceneId < b.sceneId ? -1 : 1,
        );
    },

    async getById(pageId) {
      return db.query.scenePages.findFirst({ where: eq(scenePages.id, pageId) });
    },

    async createPage(currentUserId, data) {
      await assertStoryIsWritable(db, data.storyId);
      const siblings = livePagesOfScene(data.sceneId);
      const at = Math.min(Math.max(data.position ?? siblings.length, 0), siblings.length);
      const rank = rankBetween(siblings[at - 1]?.rank ?? null, siblings[at]?.rank ?? null);
      const row = prepareNewEntityData<ScenePageInsert>({
        storyId: data.storyId,
        sceneId: data.sceneId,
        rank,
        ...mediaColumns(data.media),
        fit: data.fit ?? 'contain',
        text: data.text ?? null,
      });
      const userIdToLog = await userIdFor(currentUserId, data.storyId);
      const created = await runLocalWrite(db, data.storyId, () => {
        const inserted = db.insert(scenePages).values(row).returning().get();
        recordLocalOperationSync(
          db,
          data.storyId,
          userIdToLog,
          'create',
          'ScenePage',
          inserted.id,
          {
            ...inserted,
          },
        );
        return inserted;
      });
      entityEventEmitter.emit('scene_page_changed', data.storyId, created.id);
      return created;
    },

    async updatePage(currentUserId, pageId, changes) {
      const original = await db.query.scenePages.findFirst({ where: eq(scenePages.id, pageId) });
      if (!original) throw new Error(`ScenePage ${pageId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);
      const normalised = {
        ...(changes.text !== undefined ? { text: changes.text?.trim() ? changes.text : null } : {}),
        ...(changes.fit !== undefined ? { fit: changes.fit } : {}),
      };
      const changed = getChangedFields(original, { ...original, ...normalised });
      delete changed.version;
      delete changed.updatedAt;
      if (Object.keys(changed).length === 0) return original;
      return writeChange(currentUserId, original, normalised);
    },

    async replaceMedia(currentUserId, pageId, media) {
      const original = await db.query.scenePages.findFirst({ where: eq(scenePages.id, pageId) });
      if (!original) throw new Error(`ScenePage ${pageId} not found for update.`);
      await assertStoryIsWritable(db, original.storyId);
      return writeChange(currentUserId, original, mediaColumns(media));
    },

    async movePage(currentUserId, pageId, toPosition) {
      const original = await db.query.scenePages.findFirst({ where: eq(scenePages.id, pageId) });
      if (!original) throw new Error(`ScenePage ${pageId} not found for move.`);
      await assertStoryIsWritable(db, original.storyId);
      const others = livePagesOfScene(original.sceneId).filter((page) => page.id !== pageId);
      const at = Math.min(Math.max(toPosition, 0), others.length);
      const rank = rankBetween(others[at - 1]?.rank ?? null, others[at]?.rank ?? null);
      // Only this row is written: two devices moving different pages never contest anything.
      return writeChange(currentUserId, original, { rank });
    },

    async deletePage(currentUserId, pageId) {
      const original = await db.query.scenePages.findFirst({ where: eq(scenePages.id, pageId) });
      if (!original) {
        console.warn(`Attempted to delete non-existent scene page ${pageId}.`);
        return;
      }
      await assertStoryIsWritable(db, original.storyId);
      const userIdToLog = await userIdFor(currentUserId, original.storyId);
      const deleted = await runLocalWrite(db, original.storyId, () => {
        const row = db
          .update(scenePages)
          .set({
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            version: sql`${scenePages.version} + 1`,
          })
          .where(eq(scenePages.id, pageId))
          .returning({
            id: scenePages.id,
            storyId: scenePages.storyId,
            isDeleted: scenePages.isDeleted,
            version: scenePages.version,
          })
          .get();
        if (!row) throw new Error(`Failed to delete scene page ${pageId}.`);
        recordLocalOperationSync(db, row.storyId, userIdToLog, 'delete', 'ScenePage', pageId, {
          id: row.id,
          isDeleted: row.isDeleted,
          version: row.version,
        });
        return row;
      });
      entityEventEmitter.emit('scene_page_changed', deleted.storyId, pageId);
    },
  };

  async function writeChange(
    currentUserId: string,
    original: ScenePageSelect,
    changes: Partial<Pick<ScenePageSelect, 'rank' | 'text' | 'fit' | 'sketchId' | 'galleryId'>>,
  ): Promise<ScenePageSelect> {
    const userIdToLog = await userIdFor(currentUserId, original.storyId);
    const updated = await runLocalWrite(db, original.storyId, () => {
      db.update(scenePages)
        .set({ ...changes, updatedAt: new Date(), version: sql`${scenePages.version} + 1` })
        .where(eq(scenePages.id, original.id))
        .run();
      const row = db.select().from(scenePages).where(eq(scenePages.id, original.id)).get();
      if (!row) throw new Error(`Failed to retrieve updated ScenePage ${original.id}.`);
      const operationChanges = getChangedFields(original, row);
      recordLocalOperationSync(
        db,
        row.storyId,
        userIdToLog,
        'update',
        'ScenePage',
        original.id,
        operationChanges,
      );
      return row;
    });
    entityEventEmitter.emit('scene_page_changed', updated.storyId, original.id);
    return updated;
  }
};

/** Pages grouped by scene, each scene's in order: the shape a manuscript reads them in. */
export function groupPagesByScene(
  pages: readonly ScenePageSelect[],
): Map<string, ScenePageSelect[]> {
  const grouped = new Map<string, ScenePageSelect[]>();
  for (const page of [...pages].sort(compareRanked)) {
    const list = grouped.get(page.sceneId) ?? [];
    list.push(page);
    grouped.set(page.sceneId, list);
  }
  return grouped;
}

/** Whether a page still has an image to show: both are null once its Sketch or medium is gone. */
export function pageHasMedia(page: Pick<ScenePageSelect, 'sketchId' | 'galleryId'>): boolean {
  return page.sketchId !== null || page.galleryId !== null;
}
