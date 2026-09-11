import type { EffectiveStoryRole, FullStoryExportType } from '@keres/shared';
import { STORY_OWNER_ONLY_FIELDS } from '@keres/shared';
import { and, count, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { StoryInsert, StorySelect } from '../../db/schema';
import { choices, favorites, plots, servers, stories } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import i18n from '../../utils/i18n';
import {
  assertStoryIsOwned,
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
  StoryOwnerOnlyError,
} from '../../utils/syncUtils';
import { createKeresAxiosInstance, isOfflineError } from '../apiClient';
import { authTokenManager } from '../AuthTokenManager';
import { mediaFileService } from '../MediaFileService';
import { createServerService } from '../ServerService';
import { createChoiceService } from './ChoiceService';
import { createFavoriteService } from './FavoriteService';
import { createSceneService } from './SceneService';
import { SQLiteStoryPackageExporter } from './story-packages/SQLiteStoryPackageExporter';
import { importSQLiteStoryPackage } from './story-packages/SQLiteStoryPackageImporter';
import { createStoryArcService } from './StoryArcService';
import { purgeStoryLocally } from './storyLocalPurge';
import type { LinearCompatibilityResult } from './storyTypeConversion';
import {
  checkLinearCompatibility as checkLinearCompatibilityGraph,
  classifyEdges,
  computeChapterChainOrder,
  groupScenesByChapter,
  loadStoryGraph,
} from './storyTypeConversion';

/**
 * Wipes a story and every entity that belongs to it from the local database. Story
 * deletion is the one entity in this app that's always permanent locally - unlike every
 * other entity, which soft-deletes so the change can sync - because a story is the sync
 * unit itself: once it's gone, there's nothing left to reconcile it against, and leaving
 * a tombstone around only lets its (often fixed, e.g. example-story) ID collide with a
 * future re-creation. See deleteStory for the server-notification step this follows.
 */
/**
 * Deletes every child-table row for a story, without touching the `stories` row itself.
 * Shared by `purgeStoryLocally` (real deletion, which deletes the story row right after this)
 * and `importFullStory` (defensive: a story ID about to be imported was just confirmed to have
 * no `stories` row, but earlier partial/failed imports or deletions - see the bug this fixed,
 * `locationRelations`/`attributeValues`/`storySchemaFields` were missing from this list until
 * now - could still have left orphaned child rows behind under the same ID).
 */
export interface StoryService {
  getAllStories(currentLocalUserId?: string): Promise<StorySelect[]>;
  getStoryById(storyId: string, currentLocalUserId?: string): Promise<StorySelect | undefined>;
  createStory(currentUserId: string, storyData: Create<StoryInsert>): Promise<StorySelect>;
  updateStory(
    currentUserId: string,
    storyId: string,
    storyData: Partial<
      Omit<
        StoryInsert,
        'id' | 'userId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >
    >,
  ): Promise<void>;
  updateStoryFavoriteStatus(
    currentUserId: string,
    storyId: string,
    isFavorite: boolean,
  ): Promise<void>;
  deleteStory(storyId: string): Promise<void>;
  checkLinearCompatibility(storyId: string): Promise<LinearCompatibilityResult>;
  /**
   * How many active Plots the story has. Plots only exist in linear stories, so the
   * settings screen consults this before offering the conversion to branching - the
   * same care `checkLinearCompatibility` takes in the opposite direction.
   */
  countActivePlots(storyId: string): Promise<number>;
  convertStoryType(
    currentUserId: string,
    storyId: string,
    targetType: 'linear' | 'branching',
  ): Promise<void>;
  unlinkFromServer(currentUserId: string, storyId: string): Promise<void>;
  importFullStory(
    userId: string,
    fullStoryData: FullStoryExportType,
    queriedServerId: string | null,
    role?: EffectiveStoryRole | null,
    localMediaPaths?: Map<string, string>,
    localImportStoryId?: string,
  ): Promise<string>;
  exportFullStory(storyId: string): Promise<FullStoryExportType>;
}

export const createStoryService = (db: AppDrizzleClient): StoryService => {
  const serverService = createServerService(db);
  const favoriteService = createFavoriteService(db);
  const sceneService = createSceneService(db);
  const choiceService = createChoiceService(db);
  return {
    async getAllStories(currentLocalUserId?: string): Promise<StorySelect[]> {
      const rows = await db.select().from(stories).where(eq(stories.isDeleted, false)).all();
      if (!currentLocalUserId) return rows;
      return Promise.all(
        rows.map(async (story) => ({
          ...story,
          isFavorite: await favoriteService.isFavorite(
            story.id,
            story.id,
            'Story',
            currentLocalUserId,
            story.isFavorite,
          ),
        })),
      );
    },

    async getStoryById(
      storyId: string,
      currentLocalUserId?: string,
    ): Promise<StorySelect | undefined> {
      const story = await db
        .select()
        .from(stories)
        .where(and(eq(stories.id, storyId), eq(stories.isDeleted, false)))
        .get();
      if (!story || !currentLocalUserId) return story;
      return {
        ...story,
        isFavorite: await favoriteService.isFavorite(
          story.id,
          story.id,
          'Story',
          currentLocalUserId,
          story.isFavorite,
        ),
      };
    },

    async createStory(currentUserId: string, storyData: Create<StoryInsert>): Promise<StorySelect> {
      const newStory = prepareNewEntityData<StoryInsert>({ ...storyData, userId: currentUserId });
      const result = await db.insert(stories).values(newStory).returning().get();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newStory.id,
        currentUserId,
      );
      await recordLocalOperation(db, newStory.id, userIdToLog, 'create', 'Story', newStory.id, {
        ...newStory,
      }); // Pass serializable data

      await createStoryArcService(db).createArc(currentUserId, {
        storyId: newStory.id,
        title: 'Arc',
        description: null,
        sortOrder: 0,
        color: null,
        icon: null,
        themeOverride: null,
        isDefault: true,
      });

      return result;
    },

    async updateStory(
      currentUserId: string,
      storyId: string,
      storyData: Partial<
        Omit<
          StoryInsert,
          'id' | 'userId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        >
      >,
    ): Promise<void> {
      const originalStory = await this.getStoryById(storyId);

      if (!originalStory) {
        throw new Error(`Story with ID ${storyId} not found.`);
      }
      await assertStoryIsWritable(db, storyId);

      const dataToPersist = { ...storyData };
      // The list is `@keres/shared`'s - the same one the server enforces on receiving the
      // synchronization (`SyncService`). A collaborator who resends the current value has the field
      // removed, so it does not become an operation in the log; whoever genuinely tries to change it gets an error, instead
      // of writing a policy the push would return forever.
      if (originalStory.serverId && originalStory.myRole !== 'owner') {
        const editable = dataToPersist as Record<string, unknown>;
        const original = originalStory as unknown as Record<string, unknown>;
        const attempted = STORY_OWNER_ONLY_FIELDS.filter(
          (field) => editable[field] !== undefined && editable[field] !== original[field],
        );
        if (attempted.length > 0) {
          throw new StoryOwnerOnlyError(i18n.t('story_owner_only_error'));
        }
        for (const field of STORY_OWNER_ONLY_FIELDS) {
          delete editable[field];
        }
      }

      const targetFavoriteBehavior =
        dataToPersist.favoriteBehavior ?? originalStory.favoriteBehavior;
      if (targetFavoriteBehavior !== 'global' && dataToPersist.isFavorite !== undefined) {
        await favoriteService.setFavorite(
          storyId,
          storyId,
          'Story',
          currentUserId,
          dataToPersist.isFavorite,
        );
        delete dataToPersist.isFavorite;
      }

      // Pre-check against a merged copy, not `storyData` alone - `storyData` is a bare partial,
      // so diffing it directly against `originalStory` would flag every field the caller didn't
      // include (id, userId, serverId, ...) as "removed" and never actually skip a no-op save.
      const potentialNewState = { ...originalStory, ...dataToPersist };
      const preCheckChanges = getChangedFields(originalStory, potentialNewState);
      delete preCheckChanges.version;
      delete preCheckChanges.updatedAt;

      if (Object.keys(preCheckChanges).length === 0) {
        console.log(
          `No significant changes detected for story ${storyId}. Skipping update and operation log.`,
        );
        return;
      }

      const [updatedStory] = await db
        .update(stories)
        .set({ ...dataToPersist, updatedAt: new Date(), version: sql`${stories.version} + 1` })
        .where(eq(stories.id, storyId))
        .returning();

      if (!updatedStory) {
        throw new Error(`Failed to update story ${storyId} or story not found.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      // Diffed against the actual persisted row, not the raw `storyData` input - logging the
      // input directly would record every field the form sends (title, description, genre...)
      // as "changed" even when only one of them actually was.
      const changes = getChangedFields(originalStory, updatedStory);
      delete changes.updatedAt;
      await recordLocalOperation(db, storyId, userIdToLog, 'update', 'Story', storyId, changes);
      entityEventEmitter.emit('story_changed', storyId, storyId);
    },

    async checkLinearCompatibility(storyId: string): Promise<LinearCompatibilityResult> {
      return checkLinearCompatibilityGraph(db, storyId);
    },

    async countActivePlots(storyId: string): Promise<number> {
      const row = await db
        .select({ count: count() })
        .from(plots)
        .where(and(eq(plots.storyId, storyId), eq(plots.isDeleted, false)))
        .get();
      return row?.count ?? 0;
    },

    async convertStoryType(
      currentUserId: string,
      storyId: string,
      targetType: 'linear' | 'branching',
    ): Promise<void> {
      const story = await this.getStoryById(storyId);
      if (!story) {
        throw new Error(`Story with ID ${storyId} not found.`);
      }
      await assertStoryIsWritable(db, storyId);
      await assertStoryIsOwned(db, storyId);
      if (story.type === targetType) {
        return;
      }

      if (targetType === 'branching') {
        // Linear -> Branching: always allowed. Each pair of consecutive scenes (by index,
        // within the chapter) becomes an explicit Choice, including the bridge between the end of one
        // chapter and the start of the next - the same shape the validation below accepts on the way back,
        // so the round-trip conversion is stable.
        const { storyChapters, storyScenes } = await loadStoryGraph(db, storyId);
        const nonEmptyChapters = groupScenesByChapter(storyChapters, storyScenes);

        for (const { scenes: chapterScenes } of nonEmptyChapters) {
          for (let i = 0; i < chapterScenes.length - 1; i++) {
            await choiceService.createChoice(currentUserId, {
              storyId,
              sceneId: chapterScenes[i].id,
              nextSceneId: chapterScenes[i + 1].id,
              text: chapterScenes[i + 1].name,
            });
          }
        }
        for (let i = 0; i < nonEmptyChapters.length - 1; i++) {
          const lastSceneOfCurrent =
            nonEmptyChapters[i].scenes[nonEmptyChapters[i].scenes.length - 1];
          const firstSceneOfNext = nonEmptyChapters[i + 1].scenes[0];
          await choiceService.createChoice(currentUserId, {
            storyId,
            sceneId: lastSceneOfCurrent.id,
            nextSceneId: firstSceneOfNext.id,
            text: firstSceneOfNext.name,
          });
        }

        await this.updateStory(currentUserId, storyId, { type: 'branching' });
        return;
      }

      // Branching -> Linear: only when the graph is compatible - the UI should call
      // `checkLinearCompatibility` first and not even offer this conversion if it is not; the check
      // here is only the safety net against a race between the two calls.
      const compatibility = await checkLinearCompatibilityGraph(db, storyId);
      if (!compatibility.compatible) {
        throw new Error(
          `Story is not compatible with Linear conversion: ${compatibility.reasons.map((r) => `${r.chapterName} (${r.kind})`).join(', ')}`,
        );
      }

      const { storyChapters, storyScenes, storyChoices } = await loadStoryGraph(db, storyId);
      const nonEmptyChapters = groupScenesByChapter(storyChapters, storyScenes);
      const { intraEdgesByChapter } = classifyEdges(nonEmptyChapters, storyChoices);

      const sceneUpdates: { sceneId: string; changes: { index: number } }[] = [];
      for (const { chapter, scenes: chapterScenes } of nonEmptyChapters) {
        const intraEdges = intraEdgesByChapter.get(chapter.id) ?? [];
        const order = computeChapterChainOrder(chapterScenes, intraEdges);
        const sceneById = new Map(chapterScenes.map((s) => [s.id, s]));
        order.forEach((sceneId, position) => {
          const scene = sceneById.get(sceneId)!;
          // 1..N within the chapter, like every scene: the conversion is precisely where the order
          // stops being given by the choices and starts being given by the index.
          const newIndex = position + 1;
          if (scene.index !== newIndex) {
            sceneUpdates.push({ sceneId, changes: { index: newIndex } });
          }
        });
      }
      if (sceneUpdates.length > 0) {
        await sceneService.batchUpdateScenes(currentUserId, storyId, sceneUpdates);
      }

      // Every choice disappears in the conversion to Linear - linear mode never stores per-Choice
      // navigation data, and a future reconversion to Branching generates new choices
      // from the scenes' order (see the branch above).
      const remainingChoices = await db
        .select({ id: choices.id })
        .from(choices)
        .where(and(eq(choices.storyId, storyId), eq(choices.isDeleted, false)))
        .all();
      for (const choice of remainingChoices) {
        await choiceService.deleteChoice(currentUserId, choice.id);
      }

      await this.updateStory(currentUserId, storyId, { type: 'linear' });
    },

    async updateStoryFavoriteStatus(
      currentUserId: string,
      storyId: string,
      isFavorite: boolean,
    ): Promise<void> {
      const originalStory = await this.getStoryById(storyId, currentUserId);

      if (!originalStory) {
        throw new Error(`Story with ID ${storyId} not found.`);
      }

      // If the favorite status hasn't actually changed, skip the update and logging
      if (originalStory.isFavorite === isFavorite) {
        console.log(
          `Story ${storyId} favorite status is already ${isFavorite}. Skipping update and operation log.`,
        );
        return;
      }
      if (originalStory.favoriteBehavior !== 'global') {
        await favoriteService.setFavorite(storyId, storyId, 'Story', currentUserId, isFavorite);
        return;
      }
      await assertStoryIsWritable(db, storyId);

      const [updatedStory] = await db
        .update(stories)
        .set({ isFavorite, updatedAt: new Date(), version: sql`${stories.version} + 1` })
        .where(eq(stories.id, storyId))
        .returning({ isFavorite: stories.isFavorite, version: stories.version });

      if (!updatedStory) {
        throw new Error(
          `Failed to update favorite status for story ${storyId} or story not found.`,
        );
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      await recordLocalOperation(db, storyId, userIdToLog, 'update', 'Story', storyId, {
        isFavorite: updatedStory.isFavorite,
        version: updatedStory.version,
      });
    },

    async deleteStory(storyId: string): Promise<void> {
      const storyToDelete = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
      });

      if (!storyToDelete) {
        console.warn(`Attempted to delete non-existent story ${storyId}.`);
        return;
      }
      await assertStoryIsWritable(db, storyId);
      await assertStoryIsOwned(db, storyId);

      // Story deletion is always permanent and always local-first (see purgeStoryLocally).
      // If the story is attached to a server, make a best-effort attempt to tell it first
      // - so its own copy gets soft-deleted there too and stays recoverable - but a
      // failed/offline attempt never blocks the local purge; deleting a story here is the
      // end of it on this device regardless of connectivity.
      if (storyToDelete.serverId) {
        const server = await db.query.servers.findFirst({
          where: eq(servers.id, storyToDelete.serverId),
        });
        if (server?.url) {
          try {
            const client = createKeresAxiosInstance({ baseURL: server.url });
            client.setTokenProvider(authTokenManager);
            client.setActiveServer(server);
            // No `version`: the local `stories.version` was never in lockstep with the
            // server's, so sending the number from here would make OCC refuse the delete. The server
            // fills in the current version when the owner omits the base (for a Story delete only).
            // No `operationTime` either: the server refuses any time more than 1s
            // ahead of its own clock (`parseOperationTime`), and the
            // device/emulator clock has no guarantee whatsoever of being in sync with the
            // server's. Omitting it lets the server use its own `new Date()` - the only
            // clock that check can safely compare against.
            const response = await client.post(`/sync/${storyId}`, [
              {
                entity: 'Story',
                id: storyId,
                type: 'delete',
              },
            ]);
            const conflict = (
              response.data?.conflicts as
                | { entity: string; entityId: string; message?: string; reason?: string }[]
                | undefined
            )?.find((c) => c.entity === 'Story' && c.entityId === storyId);
            if (conflict) {
              console.warn(
                `Server rejected deletion for story ${storyId} (proceeding with local deletion regardless): ${conflict.message || conflict.reason}`,
              );
            }
          } catch (err) {
            if (!isOfflineError(err)) {
              console.warn(
                `Failed to notify server of deletion for story ${storyId} (proceeding with local deletion regardless):`,
                (err as Error)?.message || err,
              );
            }
          }
        }
      }

      await purgeStoryLocally(db, storyId);

      // Safe to remove unconditionally: local media lives under a per-story directory
      // (see mediaFileService.storyMediaDirectory), never shared with any other story on
      // this device, so no other story can still be referencing a file in it.
      mediaFileService.deleteStoryMedia(storyId);
    },

    async unlinkFromServer(currentUserId: string, storyId: string): Promise<void> {
      const story = await this.getStoryById(storyId);
      if (!story) {
        throw new Error(`Story with ID ${storyId} not found.`);
      }
      if (!story.serverId) {
        return; // Already fully local.
      }
      await assertStoryIsWritable(db, storyId);
      await assertStoryIsOwned(db, storyId);

      const server = await db.query.servers.findFirst({ where: eq(servers.id, story.serverId) });
      if (!server?.url) {
        // The server row itself is gone locally - nothing to notify, just drop the stale link.
        if (server?.idUser) {
          await favoriteService.migrateUserIdentity(storyId, server.idUser, currentUserId);
        } else {
          // The downloaded story keeps only the account's own favourites. If the server
          // registration has vanished, those rows are the only remaining source for recovering the identity.
          const formerUserIds = await db
            .selectDistinct({ userId: favorites.userId })
            .from(favorites)
            .where(eq(favorites.storyId, storyId))
            .all();
          for (const { userId } of formerUserIds) {
            await favoriteService.migrateUserIdentity(storyId, userId, currentUserId);
          }
        }
        await this.updateStory(currentUserId, storyId, {
          serverId: null,
          lastPublicFavoriteLog: 0,
        });
        return;
      }

      // Unlike deleteStory's best-effort notification (the local purge happens regardless of
      // connectivity), this one has to succeed - it's the only thing that actually removes the
      // story's data from the server, which is the whole point of taking it offline. The
      // caller (UI) is expected to have already confirmed ownership and zero collaborators
      // before offering this action at all.
      //
      // No `version` in the payload, same reasoning as deleteStory: local `stories.version`
      // was never kept in lockstep with the server's copy, so sending it would make OCC
      // reject this almost every time. The server fills in the live version when the owner
      // omits the base on a Story delete.
      //
      // No `operationTime` either: the server rejects any timestamp more than 1s ahead of
      // its own clock (`parseOperationTime`), and a device/emulator's clock has no guarantee
      // of being in sync with the server's. Omitting it lets the server fall back to its own
      // `new Date()` - the only clock this check can safely compare against.
      const client = createKeresAxiosInstance({ baseURL: server.url });
      client.setTokenProvider(authTokenManager);
      client.setActiveServer(server);
      const response = await client.post(`/sync/${storyId}`, [
        {
          entity: 'Story',
          id: storyId,
          type: 'delete',
        },
      ]);

      // The route always answers 200 and reports per-operation outcome in the body - a
      // rejected operation never throws, so this check is the only way to actually know
      // whether the server's copy is gone.
      const conflict = (
        response.data?.conflicts as
          | { entity: string; entityId: string; message?: string; reason?: string }[]
          | undefined
      )?.find((c) => c.entity === 'Story' && c.entityId === storyId);
      if (conflict) {
        throw new Error(
          `Server rejected the delete: ${conflict.message || conflict.reason || 'unknown reason'}`,
        );
      }

      await favoriteService.migrateUserIdentity(storyId, server.idUser, currentUserId);
      await this.updateStory(currentUserId, storyId, { serverId: null, lastPublicFavoriteLog: 0 });
    },

    async exportFullStory(storyId: string): Promise<FullStoryExportType> {
      return new SQLiteStoryPackageExporter(db).exportStory(storyId);
    },

    async importFullStory(
      userId: string,
      fullStoryData: FullStoryExportType,
      queriedServerId: string | null,
      role: EffectiveStoryRole | null = null,
      localMediaPaths?: Map<string, string>,
      localImportStoryId?: string,
    ): Promise<string> {
      return importSQLiteStoryPackage(
        db,
        userId,
        fullStoryData,
        queriedServerId,
        role,
        localMediaPaths,
        localImportStoryId,
      );
    },
  };
};
