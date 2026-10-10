import type { Scene } from '@keres/shared';
import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { SceneInsert, SceneSelect } from '../../db/schema';
import { chapters, scenes, stories } from '../../db/schema';
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
import {
  arrangedRowsSync,
  planContainerOrderSync,
  planPlacementSync,
  writeRankChangesSync,
} from './arrangedWrites';
import { buildAdvancedSearchConditions } from './advancedSearchConditions';
import { countActiveStoryEntities } from './storyEntityCount';
import { applyKeyedListSort, storyEntityConditions } from './storyEntityListQuery';
import type { AdvancedSearchCriteria, FavoriteFilterState } from '../../types/entityFilters';
import { buildCustomAttributeSearchCondition } from '../../utils/attributeSearchPredicate';
import { softDeleteRowSync } from './softDelete';
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
    advancedSearchCriteria?: AdvancedSearchCriteria,
  ): Promise<SceneSelect[]>;
  getSceneCount(storyId?: string): Promise<number>;
  /** The scene written in most recently, for picking the story back up where it was left. */
  getLastEdited(storyId: string): Promise<SceneSelect | undefined>;
  getById(sceneId: string): Promise<SceneSelect | undefined>;
  createScene(
    currentUserId: string,
    sceneData: Omit<Create<SceneInsert>, 'index'>,
  ): Promise<SceneSelect>;
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
  /** Several chapters' orders as one write: all of them, or none. */
  reorderScenesInChapters(
    currentUserId: string,
    storyId: string,
    orders: { chapterId: string; newOrder: { id: string; newIndex: number }[] }[],
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
   * A scene shows under its chapter only while the chapter lives. Deleting a chapter - here, or on
   * another device while this one placed a scene in it - leaves its scenes pointing at a
   * tombstone: they read as unchaptered instead of vanishing, on every device alike, and return
   * under the chapter if it is restored. Nothing is written - the stored chapter stays the one the
   * server holds, until the user moves the scene.
   */
  const withLiveChapters = async <T extends SceneSelect | undefined>(rows: T[]): Promise<T[]> => {
    const chapterIds = [...new Set(rows.flatMap((row) => (row?.chapterId ? [row.chapterId] : [])))];
    if (chapterIds.length === 0) return rows;
    const live = new Set(
      (
        await db
          .select({ id: chapters.id })
          .from(chapters)
          .where(and(inArray(chapters.id, chapterIds), eq(chapters.isDeleted, false)))
          .all()
      ).map((chapter) => chapter.id),
    );
    return rows.map((row) =>
      row?.chapterId && !live.has(row.chapterId) ? ({ ...row, chapterId: null } as T) : row,
    );
  };

  /**
   * A linear story has at most one start and one finish scene: the scene taking a flag takes it
   * from the others here, each one's loss recorded as its own edit. Every row an operation changes
   * is recorded, so no device learns of it any other way - the server never touches rows besides
   * the one an operation names.
   */
  const takeStartFinishSync = (
    storyId: string,
    sceneId: string,
    flags: { isStart?: boolean | null; isFinish?: boolean | null },
    userIdToLog: string,
  ): void => {
    const story = db
      .select({ type: stories.type })
      .from(stories)
      .where(eq(stories.id, storyId))
      .get();
    if (story?.type !== 'linear') return;
    for (const flag of ['isStart', 'isFinish'] as const) {
      if (flags[flag] !== true) continue;
      const holders = db
        .select({ id: scenes.id })
        .from(scenes)
        .where(
          and(
            eq(scenes.storyId, storyId),
            eq(scenes.isDeleted, false),
            eq(scenes[flag], true),
            ne(scenes.id, sceneId),
          ),
        )
        .all();
      for (const holder of holders) {
        const row = db
          .update(scenes)
          .set({ [flag]: false, updatedAt: new Date(), version: sql`${scenes.version} + 1` })
          .where(eq(scenes.id, holder.id))
          .returning({ version: scenes.version })
          .get();
        if (!row) continue;
        recordLocalOperationSync(db, storyId, userIdToLog, 'update', 'Scene', holder.id, {
          [flag]: false,
          version: row.version,
        });
      }
    }
  };

  /**
   * Chapters' orders as one unit: each chapter's scenes take the ranks that put them in the given
   * order - only the scenes that actually moved are edited. An order naming a scene no longer in
   * the chapter (a list gone stale) still lands on the scenes that are there.
   */
  const reorderInChapters: SceneService['reorderScenesInChapters'] = async (
    currentUserId,
    storyId,
    orders,
  ) => {
    if (orders.length === 0) return;
    await assertStoryIsWritable(db, storyId);
    const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
    await runLocalWrite(db, storyId, () => {
      for (const { chapterId, newOrder } of orders) {
        const orderedIds = [...newOrder]
          .sort((left, right) => left.newIndex - right.newIndex)
          .map((item) => item.id);
        const changes = planContainerOrderSync(db, 'Scene', storyId, { chapterId }, orderedIds);
        writeRankChangesSync(db, storyId, userIdToLog, 'Scene', changes);
      }
    });
    entityEventEmitter.emit('scene_changed', storyId, 'reorder');
  };

  return {
    async getSceneCount(storyId?: string): Promise<number> {
      return countActiveStoryEntities(db, scenes, storyId);
    },

    async getLastEdited(storyId: string): Promise<SceneSelect | undefined> {
      const latest = await db
        .select()
        .from(scenes)
        .where(and(eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)))
        .orderBy(desc(scenes.updatedAt))
        .limit(1)
        .all();
      return (await withLiveChapters(latest))[0];
    },

    async getScenesByStoryId(
      storyId,
      searchTerm,
      sortBy,
      sortDirection,
      favoriteFilterState,
      advancedSearchCriteria,
    ): Promise<SceneSelect[]> {
      const conditions: SQL<boolean>[] = storyEntityConditions(scenes, storyId, {
        searchColumn: scenes.name,
        searchTerm,
        favoriteFilterState,
      });

      conditions.push(
        ...(await buildAdvancedSearchConditions(
          'Scene',
          scenes,
          advancedSearchCriteria,
          (field, value) => buildCustomAttributeSearchCondition(db, scenes.id, field, value),
        )),
      );

      const query = db
        .select()
        .from(scenes)
        .where(and(...conditions))
        .$dynamic();

      const sorted = applyKeyedListSort(
        query,
        sortBy,
        sortDirection,
        {
          name: scenes.name,
          index: scenes.index,
          createdAt: scenes.createdAt,
          updatedAt: scenes.updatedAt,
        },
        scenes.index, // Default sort by index
      );

      return withLiveChapters(await sorted.all());
    },

    async getById(sceneId: string): Promise<SceneSelect | undefined> {
      const scene = await db.query.scenes.findFirst({
        where: and(eq(scenes.id, sceneId), eq(scenes.isDeleted, false)),
      });
      const [shown] = await withLiveChapters([scene]);
      return decorateFavorite(db, 'Scene', shown);
    },

    async createScene(
      currentUserId: string,
      sceneData: Omit<Create<SceneInsert>, 'index'>,
    ): Promise<SceneSelect> {
      await assertStoryIsWritable(db, sceneData.storyId);
      let newScene = prepareNewEntityData<SceneInsert>({ ...sceneData, index: 1, rank: '' });
      const favorite = await normalizeFavoriteCreate(db, newScene.storyId, 'Scene', newScene);
      newScene = favorite.data;
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newScene.storyId,
        currentUserId,
      );
      const result = await runLocalWrite(db, newScene.storyId, () => {
        // A new scene enters at the end of its chapter; the database numbers it from its rank.
        const container = { chapterId: newScene.chapterId ?? null };
        const placement = planPlacementSync(db, 'Scene', newScene.storyId, container, newScene.id);
        db.insert(scenes)
          .values({
            ...newScene,
            rank: placement.get(newScene.id)!,
            index: arrangedRowsSync(db, 'Scene', newScene.storyId, container).length + 1,
          })
          .run();
        // Recorded as the database holds it: its number already derived from its rank.
        const inserted = db.select().from(scenes).where(eq(scenes.id, newScene.id)).get()!;
        recordLocalOperationSync(
          db,
          newScene.storyId,
          userIdToLog,
          'create',
          'Scene',
          newScene.id,
          { ...inserted },
        );
        writeRankChangesSync(
          db,
          newScene.storyId,
          userIdToLog,
          'Scene',
          placement,
          new Set([newScene.id]),
        );
        takeStartFinishSync(newScene.storyId, newScene.id, newScene, userIdToLog);
        return db.select().from(scenes).where(eq(scenes.id, newScene.id)).get()!;
      });
      // After the create, so its operation is never pushed ahead of the entity it points at.
      await persistInitialFavorite(
        db,
        newScene.storyId,
        newScene.id,
        'Scene',
        currentUserId,
        favorite.individualFavorite,
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

      // A place is the scene's rank, and its number derives from it: neither is set by a form.
      const { index: _index, rank: _rank, ...placeless } = sceneData;
      sceneData = placeless;
      // Changing chapter means changing queue: the scene enters at the end of the new one (the
      // rank is taken inside the write below), and the old one closes its gap by itself.
      const chapterChanging =
        sceneData.chapterId !== undefined && sceneData.chapterId !== originalScene.chapterId;

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

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        originalScene.storyId,
        currentUserId,
      );
      const updatedScene = await runLocalWrite(db, originalScene.storyId, () => {
        const placement = chapterChanging
          ? planPlacementSync(
              db,
              'Scene',
              originalScene.storyId,
              { chapterId: sceneData.chapterId ?? null },
              sceneId,
            )
          : undefined;
        db.update(scenes)
          .set({
            ...sceneData,
            ...(placement ? { rank: placement.get(sceneId)! } : {}),
            updatedAt: new Date(),
            version: sql`${scenes.version} + 1`,
          })
          .where(eq(scenes.id, sceneId))
          .run();

        const updated = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();
        if (!updated) {
          throw new Error(`Failed to retrieve updated scene ${sceneId}.`);
        }
        recordLocalOperationSync(db, updated.storyId, userIdToLog, 'update', 'Scene', sceneId, {
          ...getChangedFields(originalScene, updated),
          // A move states its rank in the new chapter even when it equals the old one: the
          // rank places it among that chapter's scenes on every device.
          ...(placement ? { rank: updated.rank } : {}),
        });
        if (placement) {
          writeRankChangesSync(
            db,
            updated.storyId,
            userIdToLog,
            'Scene',
            placement,
            new Set([sceneId]),
          );
        }
        takeStartFinishSync(updated.storyId, sceneId, sceneData, userIdToLog);
        return updated;
      });
      entityEventEmitter.emit('scene_changed', updatedScene.storyId, updatedScene.id);

      return updatedScene;
    },

    async deleteScene(currentUserId: string, sceneId: string): Promise<void> {
      const sceneToDelete = await db.query.scenes.findFirst({ where: eq(scenes.id, sceneId) });
      if (!sceneToDelete) {
        console.warn(`Attempted to delete non-existent scene ${sceneId}.`);
        return;
      }
      await assertStoryIsWritable(db, sceneToDelete.storyId);
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        sceneToDelete.storyId,
        currentUserId,
      );

      const updatedScene = await runLocalWrite(db, sceneToDelete.storyId, () => {
        // The chapter closes the gap by itself: its numbers derive from the live scenes' ranks.
        const deleted = softDeleteRowSync(db, scenes, 'Scene', sceneId, userIdToLog);
        return deleted;
      });
      entityEventEmitter.emit('scene_changed', updatedScene.storyId, updatedScene.id);
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
        return withLiveChapters(allScenes);
      } catch (error) {
        console.error(`Error fetching all scenes for story ${storyId}:`, error);
        return [];
      }
    },

    reorderScenes(currentUserId, storyId, chapterId, newOrder) {
      return reorderInChapters(currentUserId, storyId, [{ chapterId, newOrder }]);
    },

    reorderScenesInChapters: reorderInChapters,

    async batchUpdateScenes(
      currentUserId: string,
      storyId: string,
      updates: { sceneId: string; changes: Partial<Omit<Scene, 'id' | 'storyId'>> }[],
    ): Promise<void> {
      await assertStoryIsWritable(db, storyId);
      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);

      const changedSceneIds = await runLocalWrite(db, storyId, () => {
        const changed: string[] = [];
        for (const update of updates) {
          // A scene's number derives from its rank; a batch of field edits never sets it.
          const { sceneId } = update;
          const { index: _index, ...changes } = update.changes;

          const originalScene = db.select().from(scenes).where(eq(scenes.id, sceneId)).get();

          if (!originalScene) {
            console.warn(`Scene with ID ${sceneId} not found during batch update.`);
            continue; // or throw? continue is safer for a batch.
          }

          const updatedScene = db
            .update(scenes)
            .set({ ...changes, updatedAt: new Date(), version: sql`${scenes.version} + 1` })
            .where(eq(scenes.id, sceneId))
            .returning()
            .get();

          if (updatedScene) {
            const actualChanges = getChangedFields(originalScene, updatedScene);

            if (Object.keys(actualChanges).length > 0) {
              recordLocalOperationSync(
                db,
                storyId,
                userIdToLog,
                'update',
                'Scene',
                sceneId,
                actualChanges,
              );
              changed.push(sceneId);
            }
          }
        }
        return changed;
      });
      for (const sceneId of changedSceneIds) {
        entityEventEmitter.emit('scene_changed', storyId, sceneId);
      }
    },

    async getPreviousNextScenes(
      storyId: string,
      currentSceneId: string,
      chapterId: string | null,
    ): Promise<{ previousScene: SceneSelect | undefined; nextScene: SceneSelect | undefined }> {
      // Unchaptered includes the scenes of a deleted chapter, as the lists show them.
      const allScenesInChapter = chapterId
        ? await db.query.scenes.findMany({
            where: and(
              eq(scenes.storyId, storyId),
              eq(scenes.chapterId, chapterId),
              eq(scenes.isDeleted, false),
            ),
            orderBy: asc(scenes.index),
          })
        : (
            await withLiveChapters(
              await db.query.scenes.findMany({
                where: and(eq(scenes.storyId, storyId), eq(scenes.isDeleted, false)),
                orderBy: asc(scenes.name),
              }),
            )
          ).filter((scene) => !scene.chapterId);

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
