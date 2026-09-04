import type { Scene } from '@keres/shared';
import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { SceneInsert, SceneSelect } from '../../db/schema';
import { chapters, scenes } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import { buildAdvancedSearchConditions } from './advancedSearchConditions';
import { countActiveStoryEntities } from './storyEntityCount';
import type { FavoriteFilterState } from '../../types/entityFilters';
import { buildCustomAttributeSearchCondition } from '../../utils/attributeSearchPredicate';
import {
  decorateFavorite,
  normalizeFavoriteCreate,
  normalizeFavoriteUpdate,
  persistInitialFavorite,
} from './favoriteBehaviorUtils';

export type { FavoriteFilterState };

export interface SceneService {
  getScenesByStoryId(
    storyId: string,
    searchTerm?: string,
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: { [key: string]: any },
  ): Promise<SceneSelect[]>;
  getSceneCount(storyId?: string): Promise<number>;
  getById(sceneId: string): Promise<SceneSelect | undefined>;
  createScene(currentUserId: string, sceneData: Create<SceneInsert>): Promise<SceneSelect>;
  updateScene(
    currentUserId: string,
    sceneId: string,
    sceneData: Partial<
      Omit<
        SceneInsert,
        'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >
    >,
  ): Promise<SceneSelect>;
  deleteScene(currentUserId: string, sceneId: string): Promise<void>;
  getAllByStoryId(storyId: string): Promise<SceneSelect[]>;
  reorderScenes(
    currentUserId: string,
    storyId: string,
    chapterId: string,
    newOrder: { id: string; newIndex: number }[],
  ): Promise<void>;
  batchUpdateScenes(
    currentUserId: string,
    storyId: string,
    updates: { sceneId: string; changes: Partial<Omit<Scene, 'id' | 'storyId'>> }[],
  ): Promise<void>;
  getPreviousNextScenes(
    storyId: string,
    currentSceneId: string,
    chapterId: string | null,
  ): Promise<{ previousScene: SceneSelect | undefined; nextScene: SceneSelect | undefined }>;
}

export const createSceneService = (db: AppDrizzleClient): SceneService => {
  const serverService = createServerService(db);

  /**
   * A scene's index is 1..N **within the chapter**, with no holes - the same convention as the chapters,
   * and the only one the API accepts when reordering (it refuses a reorder whose lowest index is not 1 or
   * which does not end at N).
   */
  const nextIndexInChapter = async (storyId: string, chapterId: string | null): Promise<number> => {
    const siblings = await db
      .select({ index: scenes.index })
      .from(scenes)
      .where(
        and(
          eq(scenes.storyId, storyId),
          chapterId ? eq(scenes.chapterId, chapterId) : isNull(scenes.chapterId),
          eq(scenes.isDeleted, false),
        ),
      )
      .all();
    return siblings.reduce((highest, scene) => Math.max(highest, scene.index), 0) + 1;
  };

  /**
   * Renumbers a chapter's live scenes to 1..N, preserving the current order.
   *
   * Called when a scene leaves the chapter (deleted or moved): without it a hole is left in the
   * numbering, and one hole is enough to make the next reorder a validation conflict on the server. It
   * lives in the service, and not in the screen that moves the scene, because import and automatic
   * correction come through here too.
   */
  const renumberChapterScenes = async (
    storyId: string,
    chapterId: string | null,
    userIdToLog: string,
  ): Promise<void> => {
    if (!chapterId) return;
    const living = await db
      .select({ id: scenes.id, index: scenes.index, createdAt: scenes.createdAt })
      .from(scenes)
      .where(
        and(
          eq(scenes.storyId, storyId),
          eq(scenes.chapterId, chapterId),
          eq(scenes.isDeleted, false),
        ),
      )
      .all();

    const ordered = [...living].sort(
      (a, b) =>
        a.index - b.index ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );

    for (const [position, scene] of ordered.entries()) {
      const newIndex = position + 1;
      if (scene.index === newIndex) continue;
      const [updated] = await db
        .update(scenes)
        .set({ index: newIndex, updatedAt: new Date(), version: sql`${scenes.version} + 1` })
        .where(eq(scenes.id, scene.id))
        .returning({ version: scenes.version });
      // One `update` per scene, rather than a chapter `reorder`: the operation has to stand on its own,
      // without depending on the server having already applied the deletion or the chapter change that
      // prompted it.
      await recordLocalOperation(db, storyId, userIdToLog, 'update', 'Scene', scene.id, {
        index: newIndex,
        version: updated?.version,
      });
    }
  };

  return {
    async getSceneCount(storyId?: string): Promise<number> {
      return countActiveStoryEntities(db, scenes, storyId);
    },

    async getScenesByStoryId(
      storyId,
      searchTerm,
      sortBy,
      sortDirection,
      favoriteFilterState,
      advancedSearchCriteria,
    ): Promise<SceneSelect[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(scenes.storyId, storyId) as SQL<boolean>,
        eq(scenes.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        conditions.push(
          sql`${scenes.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>,
        );
      }

      if (favoriteFilterState === 'favorite') {
        conditions.push(eq(scenes.isFavorite, true) as SQL<boolean>);
      } else if (favoriteFilterState === 'not-favorite') {
        conditions.push(eq(scenes.isFavorite, false) as SQL<boolean>);
      }

      conditions.push(
        ...(await buildAdvancedSearchConditions(
          'Scene',
          scenes,
          advancedSearchCriteria,
          (field, value) => buildCustomAttributeSearchCondition(db, scenes.id, field, value),
        )),
      );

      const finalConditions = conditions.filter(Boolean) as SQL<boolean>[];

      let query = db
        .select()
        .from(scenes)
        .where(and(...finalConditions))
        .$dynamic();

      if (sortBy) {
        const orderBy = sortDirection === 'desc' ? desc : asc;
        switch (sortBy) {
          case 'name':
            query = query.orderBy(orderBy(scenes.name));
            break;
          case 'index':
            query = query.orderBy(orderBy(scenes.index));
            break;
          case 'createdAt':
            query = query.orderBy(orderBy(scenes.createdAt));
            break;
          case 'updatedAt':
            query = query.orderBy(orderBy(scenes.updatedAt));
            break;
          default:
            console.warn(`Unknown sortBy field: ${sortBy}`);
            break;
        }
      } else {
        query = query.orderBy(asc(scenes.index)); // Default sort by index
      }

      return query.all();
    },

    async getById(sceneId: string): Promise<SceneSelect | undefined> {
      const scene = await db.query.scenes.findFirst({
        where: and(eq(scenes.id, sceneId), eq(scenes.isDeleted, false)),
      });
      return decorateFavorite(db, 'Scene', scene);
    },

    async createScene(currentUserId: string, sceneData: Create<SceneInsert>): Promise<SceneSelect> {
      await assertStoryIsWritable(db, sceneData.storyId);
      let newScene = prepareNewEntityData<SceneInsert>(sceneData);
      const favorite = await normalizeFavoriteCreate(db, newScene.storyId, 'Scene', newScene);
      newScene = favorite.data;
      const result = await db.insert(scenes).values(newScene).returning().get();
      await persistInitialFavorite(
        db,
        newScene.storyId,
        newScene.id,
        'Scene',
        currentUserId,
        favorite.individualFavorite,
      );

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newScene.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        newScene.storyId,
        userIdToLog,
        'create',
        'Scene',
        newScene.id,
        { ...result },
      );
      entityEventEmitter.emit('scene_changed', newScene.storyId, newScene.id);

      return result;
    },

    async updateScene(
      currentUserId: string,
      sceneId: string,
      sceneData: Partial<
        Omit<
          SceneInsert,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        >
      >,
    ): Promise<SceneSelect> {
      const originalScene = await db.query.scenes.findFirst({ where: eq(scenes.id, sceneId) });
      if (!originalScene) {
        throw new Error(`Scene with ID ${sceneId} not found for update.`);
      }
      await assertStoryIsWritable(db, originalScene.storyId);
      sceneData = await normalizeFavoriteUpdate(
        db,
        originalScene.storyId,
        sceneId,
        'Scene',
        currentUserId,
        sceneData,
      );

      // Changing chapter means changing queue: the scene enters at the end of the new one and the hole it
      // leaves in the old one is closed just below. Here, and not on the form screen, so that any path that
      // moves a scene keeps both numberings intact.
      const chapterChanging =
        sceneData.chapterId !== undefined && sceneData.chapterId !== originalScene.chapterId;
      const movedFromChapterId = chapterChanging ? originalScene.chapterId : null;
      if (chapterChanging && sceneData.chapterId) {
        sceneData = {
          ...sceneData,
          index: await nextIndexInChapter(originalScene.storyId, sceneData.chapterId),
        };
      }

      const potentialNewState = { ...originalScene, ...sceneData };

      const changes = getChangedFields(originalScene, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;

      if (Object.keys(changes).length === 0) {
        console.log(
          `No significant changes detected for scene ${sceneId}. Skipping update and operation log.`,
        );
        return originalScene;
      }

      await db
        .update(scenes)
        .set({ ...sceneData, updatedAt: new Date(), version: sql`${scenes.version} + 1` })
        .where(eq(scenes.id, sceneId));

      const updatedScene = await db.query.scenes.findFirst({ where: eq(scenes.id, sceneId) });
      if (!updatedScene) {
        throw new Error(`Failed to retrieve updated scene ${sceneId}.`);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updatedScene.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        updatedScene.storyId,
        userIdToLog,
        'update',
        'Scene',
        sceneId,
        getChangedFields(originalScene, updatedScene),
      );
      entityEventEmitter.emit('scene_changed', updatedScene.storyId, updatedScene.id);

      if (movedFromChapterId) {
        await renumberChapterScenes(updatedScene.storyId, movedFromChapterId, userIdToLog);
      }

      return updatedScene;
    },

    async deleteScene(currentUserId: string, sceneId: string): Promise<void> {
      const sceneToDelete = await db.query.scenes.findFirst({ where: eq(scenes.id, sceneId) });
      if (!sceneToDelete) {
        console.warn(`Attempted to delete non-existent scene ${sceneId}.`);
        return;
      }
      await assertStoryIsWritable(db, sceneToDelete.storyId);

      const [updatedScene] = await db
        .update(scenes)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${scenes.version} + 1`,
        })
        .where(eq(scenes.id, sceneId))
        .returning({
          id: scenes.id,
          storyId: scenes.storyId,
          isDeleted: scenes.isDeleted,
          version: scenes.version,
        });

      if (!updatedScene) {
        throw new Error(`Failed to delete scene ${sceneId} or scene not found.`);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updatedScene.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        updatedScene.storyId,
        userIdToLog,
        'delete',
        'Scene',
        sceneId,
        {
          id: updatedScene.id,
          isDeleted: updatedScene.isDeleted,
          version: updatedScene.version,
        },
      );
      entityEventEmitter.emit('scene_changed', updatedScene.storyId, updatedScene.id);

      await renumberChapterScenes(sceneToDelete.storyId, sceneToDelete.chapterId, userIdToLog);
    },

    async getAllByStoryId(storyId: string): Promise<SceneSelect[]> {
      if (!storyId) {
        console.error('getAllByStoryId: storyId is required.');
        return [];
      }
      try {
        const allScenes = await db
          .select()
          .from(scenes)
          .where(and(eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)))
          .orderBy(asc(scenes.index))
          .all();
        return allScenes;
      } catch (error) {
        console.error(`Error fetching all scenes for story ${storyId}:`, error);
        return [];
      }
    },

    async reorderScenes(
      currentUserId: string,
      storyId: string,
      chapterId: string,
      newOrder: { id: string; newIndex: number }[],
    ): Promise<void> {
      await assertStoryIsWritable(db, storyId);
      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);

      await db.transaction(async (tx) => {
        for (const scene of newOrder) {
          const originalScene = await tx.query.scenes.findFirst({
            where: and(eq(scenes.id, scene.id), eq(scenes.chapterId, chapterId)),
          });
          if (!originalScene) {
            console.warn(
              `Scene with ID ${scene.id} not found in chapter ${chapterId} during reorder.`,
            );
            continue;
          }

          if (originalScene.index !== scene.newIndex) {
            await tx
              .update(scenes)
              .set({
                index: scene.newIndex,
                updatedAt: new Date(),
                version: sql`${scenes.version} + 1`,
              })
              .where(and(eq(scenes.id, scene.id), eq(scenes.chapterId, chapterId)));
          }
        }
      });

      const [chapter] = await db
        .update(chapters)
        .set({ version: sql`${chapters.version} + 1`, updatedAt: new Date() })
        .where(eq(chapters.id, chapterId))
        .returning({ version: chapters.version });

      await recordLocalOperation(db, storyId, userIdToLog, 'reorder', 'Chapter', chapterId, {
        reorderItems: newOrder.map((item) => ({ ...item })),
        version: chapter?.version,
      });
      entityEventEmitter.emit('scene_changed', storyId, 'reorder');
    },

    async batchUpdateScenes(
      currentUserId: string,
      storyId: string,
      updates: { sceneId: string; changes: Partial<Omit<Scene, 'id' | 'storyId'>> }[],
    ): Promise<void> {
      await assertStoryIsWritable(db, storyId);
      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);

      await db.transaction(async (tx) => {
        for (const update of updates) {
          const { sceneId, changes } = update;

          const originalScene = await tx.query.scenes.findFirst({
            where: eq(scenes.id, sceneId),
          });

          if (!originalScene) {
            console.warn(`Scene with ID ${sceneId} not found during batch update.`);
            continue; // or throw? continue is safer for a batch.
          }

          const [updatedScene] = await tx
            .update(scenes)
            .set({ ...changes, updatedAt: new Date(), version: sql`${scenes.version} + 1` })
            .where(eq(scenes.id, sceneId))
            .returning();

          if (updatedScene) {
            const actualChanges = getChangedFields(originalScene, updatedScene);

            if (Object.keys(actualChanges).length > 0) {
              // Pass 'tx' to recordLocalOperation if it supports transactions, otherwise use 'db'
              // For now, using 'db' as per existing patterns in the file.
              await recordLocalOperation(
                db,
                storyId,
                userIdToLog,
                'update',
                'Scene',
                sceneId,
                actualChanges,
              );
              entityEventEmitter.emit('scene_changed', storyId, sceneId);
            }
          }
        }
      });
    },

    async getPreviousNextScenes(
      storyId: string,
      currentSceneId: string,
      chapterId: string | null,
    ): Promise<{ previousScene: SceneSelect | undefined; nextScene: SceneSelect | undefined }> {
      const allScenesInChapter = await db.query.scenes.findMany({
        where: and(
          eq(scenes.storyId, storyId),
          chapterId ? eq(scenes.chapterId, chapterId) : isNull(scenes.chapterId),
          eq(scenes.isDeleted, false),
        ),
        orderBy: chapterId ? asc(scenes.index) : asc(scenes.name),
      });

      const currentSceneIndex = allScenesInChapter.findIndex(
        (scene) => scene.id === currentSceneId,
      );

      let previousScene: SceneSelect | undefined;
      let nextScene: SceneSelect | undefined;

      if (currentSceneIndex > 0) {
        previousScene = allScenesInChapter[currentSceneIndex - 1];
      }
      if (currentSceneIndex < allScenesInChapter.length - 1) {
        nextScene = allScenesInChapter[currentSceneIndex + 1];
      }

      return { previousScene, nextScene };
    },
  };
};
