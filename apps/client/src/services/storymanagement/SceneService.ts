import { Scene } from '@keres/shared';
import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { and, asc, desc, eq, sql, SQL } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import { chapters, SceneInsert, scenes, SceneSelect } from '../../db/schema';
import { Create, getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
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
    chapterId: string,
  ): Promise<{ previousScene: SceneSelect | undefined; nextScene: SceneSelect | undefined }>;
}

export const createSceneService = (db: AppDrizzleClient): SceneService => {
  const serverService = createServerService(db);
  return {
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

      if (advancedSearchCriteria && Object.keys(advancedSearchCriteria).length > 0) {
        // Scene não está descrita em `entityFieldMetadata`; sem o `?? []` um critério
        // desconhecido derruba a consulta em vez de ser ignorado.
        const sceneMetadata = entityFieldMetadata['Scene'] ?? [];
        for (const key in advancedSearchCriteria) {
          if (Object.prototype.hasOwnProperty.call(advancedSearchCriteria, key)) {
            const value = advancedSearchCriteria[key];
            const fieldMeta = sceneMetadata.find((meta) => meta.name === key);

            if (value !== undefined && value !== '' && fieldMeta) {
              if (fieldMeta.type === 'string') {
                conditions.push(
                  sql`${scenes[key as keyof SceneSelect]} LIKE ${`%${value}%`} COLLATE NOCASE` as SQL<boolean>,
                );
              } else if (fieldMeta.type === 'boolean') {
                conditions.push(eq(scenes[key as keyof SceneSelect], value) as SQL<boolean>);
              } else if (fieldMeta.type === 'number') {
                conditions.push(
                  eq(scenes[key as keyof SceneSelect], Number(value)) as SQL<boolean>,
                );
              }
            } else if (value !== undefined && value !== '') {
              const customCondition = await buildCustomAttributeSearchCondition(
                db,
                scenes.id,
                key,
                value,
              );
              if (customCondition) {
                conditions.push(customCondition);
              }
            }
          }
        }
      }

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
      chapterId: string,
    ): Promise<{ previousScene: SceneSelect | undefined; nextScene: SceneSelect | undefined }> {
      const allScenesInChapter = await db.query.scenes.findMany({
        where: and(
          eq(scenes.storyId, storyId),
          eq(scenes.chapterId, chapterId),
          eq(scenes.isDeleted, false),
        ),
        orderBy: asc(scenes.index),
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
