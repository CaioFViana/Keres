import { CURRENT_STORY_FORMAT_VERSION, EffectiveStoryRole, FullStoryExportSchema, FullStoryExportType } from '@keres/shared';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import {
  AttributeValueInsert,
  attributeValues,
  ChapterInsert,
  chapters,
  ChapterSelect,
  CharacterInsert,
  CharacterRelationInsert,
  characterRelations,
  characters,
  CharacterSceneInsert,
  characterScenes,
  CharacterSelect,
  ChoiceInsert,
  choices,
  ChoiceSelect,
  galleries,
  GalleryInsert,
  galleryRelations,
  GalleryRelationInsert,
  ItemInsert,
  ItemJourneyInsert,
  itemJourneys,
  items,
  LocationInsert,
  locations,
  LocationRelationInsert,
  locationRelations,
  LocationSelect,
  NoteInsert,
  NoteRelationInsert,
  noteRelations,
  notes,
  NoteSelect,
  operationLogs,
  SceneInsert,
  scenes,
  SceneSelect,
  servers,
  stories,
  StoryInsert, StorySelect,
  storyPermissions,
  StorySchemaFieldInsert,
  storySchemaFields,
  SuggestionInsert,
  suggestions,
  syncConflicts,
  TagInsert,
  TagRelationInsert,
  tagRelations,
  tags,
  WorldRuleInsert,
  worldRules,
  WorldRuleSelect
} from '../../db/schema';
import { Create, getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { assertStoryIsWritable, getUserIdForOperation, recordLocalOperation } from '../../utils/syncUtils';
import { createKeresAxiosInstance, isOfflineError } from '../apiClient';
import { authTokenManager } from '../AuthTokenManager';
import { mediaFileService } from '../MediaFileService';
import { createServerService } from '../ServerService';
import { createChoiceService } from './ChoiceService';
import { createSceneService } from './SceneService';
import {
  checkLinearCompatibility as checkLinearCompatibilityGraph,
  classifyEdges,
  computeChapterChainOrder,
  groupScenesByChapter,
  LinearCompatibilityResult,
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
async function deleteStoryChildRows(tx: AppDrizzleTransaction, storyId: string): Promise<void> {
  await tx.delete(attributeValues).where(eq(attributeValues.storyId, storyId)).run();
  await tx.delete(chapters).where(eq(chapters.storyId, storyId)).run();
  await tx.delete(characterRelations).where(eq(characterRelations.storyId, storyId)).run();
  await tx.delete(characterScenes).where(eq(characterScenes.storyId, storyId)).run();
  await tx.delete(characters).where(eq(characters.storyId, storyId)).run();
  await tx.delete(choices).where(eq(choices.storyId, storyId)).run();
  await tx.delete(galleryRelations).where(eq(galleryRelations.storyId, storyId)).run();
  await tx.delete(galleries).where(eq(galleries.storyId, storyId)).run();
  await tx.delete(itemJourneys).where(eq(itemJourneys.storyId, storyId)).run();
  await tx.delete(items).where(eq(items.storyId, storyId)).run();
  await tx.delete(locationRelations).where(eq(locationRelations.storyId, storyId)).run();
  await tx.delete(locations).where(eq(locations.storyId, storyId)).run();
  await tx.delete(noteRelations).where(eq(noteRelations.storyId, storyId)).run();
  await tx.delete(notes).where(eq(notes.storyId, storyId)).run();
  await tx.delete(operationLogs).where(eq(operationLogs.storyId, storyId)).run();
  await tx.delete(scenes).where(eq(scenes.storyId, storyId)).run();
  await tx.delete(storyPermissions).where(eq(storyPermissions.storyId, storyId)).run();
  await tx.delete(storySchemaFields).where(eq(storySchemaFields.storyId, storyId)).run();
  await tx.delete(suggestions).where(eq(suggestions.storyId, storyId)).run();
  await tx.delete(syncConflicts).where(eq(syncConflicts.storyId, storyId)).run();
  await tx.delete(tagRelations).where(eq(tagRelations.storyId, storyId)).run();
  await tx.delete(tags).where(eq(tags.storyId, storyId)).run();
  await tx.delete(worldRules).where(eq(worldRules.storyId, storyId)).run();
}

async function purgeStoryLocally(db: AppDrizzleClient, storyId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await deleteStoryChildRows(tx, storyId);
    await tx.delete(stories).where(eq(stories.id, storyId)).run();
  });
}

export interface StoryService {
  getAllStories(): Promise<StorySelect[]>;
  getStoryById(storyId: string): Promise<StorySelect | undefined>;
  createStory(currentUserId: string, storyData: Create<StoryInsert>): Promise<StorySelect>;
  updateStory(currentUserId: string, storyId: string, storyData: Partial<Omit<StoryInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void>;
  getStoryCounts(): Promise<{ totalStories: number; branchingStories: number }>;
  getCharacterCount(storyId?: string): Promise<number>;
  getChoiceCount(storyId?: string): Promise<number>;
  getLocationCount(storyId?: string): Promise<number>;
  getChapterCount(storyId?: string): Promise<number>;
  getSceneCount(storyId?: string): Promise<number>;
  getNoteCount(storyId?: string): Promise<number>;
  getWorldRuleCount(storyId?: string): Promise<number>;
  getItemCount(storyId?: string): Promise<number>;
  getGalleryCount(storyId?: string): Promise<number>;
  getTagCount(storyId?: string): Promise<number>;

  // New creation methods using Create<T>
  createCharacter(currentUserId: string, characterData: Create<CharacterInsert>): Promise<CharacterSelect>;
  createChapter(currentUserId: string, chapterData: Create<ChapterInsert>): Promise<ChapterSelect>;
  createLocation(currentUserId: string, locationData: Create<LocationInsert>): Promise<LocationSelect>;
  createScene(currentUserId: string, sceneData: Create<SceneInsert>): Promise<SceneSelect>;
  createNote(currentUserId: string, noteData: Create<NoteInsert>): Promise<NoteSelect>;
  createWorldRule(currentUserId: string, worldRuleData: Create<WorldRuleInsert>): Promise<WorldRuleSelect>;
  createChoice(currentUserId: string, choiceData: Create<ChoiceInsert>): Promise<ChoiceSelect>;

  updateStoryFavoriteStatus(currentUserId: string, storyId: string, isFavorite: boolean): Promise<void>;
  deleteStory(storyId: string): Promise<void>;
  checkLinearCompatibility(storyId: string): Promise<LinearCompatibilityResult>;
  convertStoryType(currentUserId: string, storyId: string, targetType: 'linear' | 'branching'): Promise<void>;
  unlinkFromServer(currentUserId: string, storyId: string): Promise<void>;
  getBranchingStoryForkCount(): Promise<number>;
  importFullStory(userId: string, fullStoryData: FullStoryExportType, queriedServerId: string | null, role?: EffectiveStoryRole | null, localMediaPaths?: Map<string, string>): Promise<string>;
  exportFullStory(storyId: string): Promise<FullStoryExportType>;
}

export const createStoryService = (db: AppDrizzleClient): StoryService => {
  const serverService = createServerService(db);
  return {
    async getAllStories(): Promise<StorySelect[]> {
      return db.select().from(stories).where(eq(stories.isDeleted, false)).all();
    },

    async getStoryById(storyId: string): Promise<StorySelect | undefined> {
      return db.select().from(stories).where(and(eq(stories.id, storyId), eq(stories.isDeleted, false))).get();
    },

    async createStory(currentUserId: string, storyData: Create<StoryInsert>): Promise<StorySelect> {
      const newStory = prepareNewEntityData<StoryInsert>({ ...storyData, userId: currentUserId });
      const result = await db.insert(stories).values(newStory).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newStory.id, currentUserId);
      await recordLocalOperation(db, newStory.id, userIdToLog, 'create', 'Story', newStory.id, { ...newStory }); // Pass serializable data

      return result;
    },

    async updateStory(currentUserId: string, storyId: string, storyData: Partial<Omit<StoryInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void> {
      const originalStory = await this.getStoryById(storyId);

      if (!originalStory) {
        throw new Error(`Story with ID ${storyId} not found.`);
      }
      await assertStoryIsWritable(db, storyId);

      // Pre-check against a merged copy, not `storyData` alone - `storyData` is a bare partial,
      // so diffing it directly against `originalStory` would flag every field the caller didn't
      // include (id, userId, serverId, ...) as "removed" and never actually skip a no-op save.
      const potentialNewState = { ...originalStory, ...storyData };
      const preCheckChanges = getChangedFields(originalStory, potentialNewState);
      delete preCheckChanges.version;
      delete preCheckChanges.updatedAt;

      if (Object.keys(preCheckChanges).length === 0) {
        console.log(`No significant changes detected for story ${storyId}. Skipping update and operation log.`);
        return;
      }

      const [updatedStory] = await db.update(stories)
        .set({ ...storyData, updatedAt: new Date(), version: sql`${stories.version} + 1` })
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
      delete changes.version;
      delete changes.updatedAt;
      await recordLocalOperation(db, storyId, userIdToLog, 'update', 'Story', storyId, changes);
    },

    async getStoryCounts(): Promise<{ totalStories: number; branchingStories: number }> {
      const totalStoriesResult = await db.select({ count: count() }).from(stories).where(eq(stories.isDeleted, false)).get();
      const branchingStoriesResult = await db.select({ count: count() }).from(stories).where(and(eq(stories.type, 'branching'), eq(stories.isDeleted, false))).get();
      return {
        totalStories: totalStoriesResult?.count || 0,
        branchingStories: branchingStoriesResult?.count || 0,
      };
    },

    async getCharacterCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(characters)
        .innerJoin(stories, eq(characters.storyId, stories.id))
        .where(storyId ? and(eq(characters.storyId, storyId), eq(stories.isDeleted, false), eq(characters.isDeleted, false)) : and(eq(stories.isDeleted, false), eq(characters.isDeleted, false)))
        .get();
      return result?.count || 0;
    },

    async getChoiceCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(choices)
        .innerJoin(scenes, eq(choices.sceneId, scenes.id))
        .innerJoin(stories, eq(scenes.storyId, stories.id))
        .where(storyId ? and(eq(stories.id, storyId), eq(stories.isDeleted, false), eq(choices.isDeleted, false)) : and(eq(stories.isDeleted, false), eq(choices.isDeleted, false)))
        .get();
      return result?.count || 0;
    },

    async getLocationCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(locations)
        .innerJoin(stories, eq(locations.storyId, stories.id))
        .where(storyId ? and(eq(stories.id, storyId), eq(stories.isDeleted, false), eq(locations.isDeleted, false)) : and(eq(stories.isDeleted, false), eq(locations.isDeleted, false)))
        .get();
      return result?.count || 0;
    },

    async getChapterCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(chapters)
        .innerJoin(stories, eq(chapters.storyId, stories.id))
        .where(storyId ? and(eq(chapters.storyId, storyId), eq(stories.isDeleted, false), eq(chapters.isDeleted, false)) : and(eq(stories.isDeleted, false), eq(chapters.isDeleted, false)))
        .get();
      return result?.count || 0;
    },

    async getSceneCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(scenes)
        .innerJoin(stories, eq(scenes.storyId, stories.id))
        .where(storyId ? and(eq(stories.id, storyId), eq(stories.isDeleted, false), eq(scenes.isDeleted, false)) : and(eq(stories.isDeleted, false), eq(scenes.isDeleted, false)))
        .get();
      return result?.count || 0;
    },

    async getNoteCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(notes)
        .innerJoin(stories, eq(notes.storyId, stories.id))
        .where(storyId ? and(eq(stories.id, storyId), eq(stories.isDeleted, false), eq(notes.isDeleted, false)) : and(eq(stories.isDeleted, false), eq(notes.isDeleted, false)))
        .get();
      return result?.count || 0;
    },

    async getWorldRuleCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(worldRules)
        .innerJoin(stories, eq(worldRules.storyId, stories.id))
        .where(storyId ? and(eq(stories.id, storyId), eq(stories.isDeleted, false), eq(worldRules.isDeleted, false)) : and(eq(stories.isDeleted, false), eq(worldRules.isDeleted, false)))
        .get();
      return result?.count || 0;
    },

    async getItemCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(items)
        .innerJoin(stories, eq(items.storyId, stories.id))
        .where(storyId ? and(eq(items.storyId, storyId), eq(stories.isDeleted, false), eq(items.isDeleted, false)) : and(eq(stories.isDeleted, false), eq(items.isDeleted, false)))
        .get();
      return result?.count || 0;
    },

    async getGalleryCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(galleries)
        .innerJoin(stories, eq(galleries.storyId, stories.id))
        .where(storyId ? and(eq(galleries.storyId, storyId), eq(stories.isDeleted, false), eq(galleries.isDeleted, false)) : and(eq(stories.isDeleted, false), eq(galleries.isDeleted, false)))
        .get();
      return result?.count || 0;
    },

    async getTagCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(tags)
        .innerJoin(stories, eq(tags.storyId, stories.id))
        .where(storyId ? and(eq(tags.storyId, storyId), eq(stories.isDeleted, false), eq(tags.isDeleted, false)) : and(eq(stories.isDeleted, false), eq(tags.isDeleted, false)))
        .get();
      return result?.count || 0;
    },

    async createCharacter(currentUserId: string, characterData: Create<CharacterInsert>): Promise<CharacterSelect> {
      const newCharacter = prepareNewEntityData<CharacterInsert>(characterData);
      const result = await db.insert(characters).values(newCharacter).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newCharacter.storyId, currentUserId);
      await recordLocalOperation(db, newCharacter.storyId, userIdToLog, 'create', 'Character', newCharacter.id, { ...newCharacter }); // Pass serializable data

      return result;
    },

    async createChapter(currentUserId: string, chapterData: Create<ChapterInsert>): Promise<ChapterSelect> {
      const newChapter = prepareNewEntityData<ChapterInsert>(chapterData);
      const result = await db.insert(chapters).values(newChapter).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newChapter.storyId, currentUserId);
      await recordLocalOperation(db, newChapter.storyId, userIdToLog, 'create', 'Chapter', newChapter.id, { ...newChapter }); // Pass serializable data

      return result;
    },

    async createLocation(currentUserId: string, locationData: Create<LocationInsert>): Promise<LocationSelect> {
      const newLocation = prepareNewEntityData<LocationInsert>(locationData);
      const result = await db.insert(locations).values(newLocation).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newLocation.storyId, currentUserId);
      await recordLocalOperation(db, newLocation.storyId, userIdToLog, 'create', 'Location', newLocation.id, { ...newLocation }); // Pass serializable data

      return result;
    },

    async createScene(currentUserId: string, sceneData: Create<SceneInsert>): Promise<SceneSelect> {
      const newScene = prepareNewEntityData<SceneInsert>(sceneData);
      const result = await db.insert(scenes).values(newScene).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newScene.storyId, currentUserId);
      await recordLocalOperation(db, newScene.storyId, userIdToLog, 'create', 'Scene', newScene.id, { ...newScene }); // Pass serializable data

      return result;
    },

    async createNote(currentUserId: string, noteData: Create<NoteInsert>): Promise<NoteSelect> {
      const newNote = prepareNewEntityData<NoteInsert>(noteData);
      const result = await db.insert(notes).values(newNote).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newNote.storyId, currentUserId);
      await recordLocalOperation(db, newNote.storyId, userIdToLog, 'create', 'Note', newNote.id, { ...newNote }); // Pass serializable data

      return result;
    },

    async createWorldRule(currentUserId: string, worldRuleData: Create<WorldRuleInsert>): Promise<WorldRuleSelect> {
      const newWorldRule = prepareNewEntityData<WorldRuleInsert>(worldRuleData);
      const result = await db.insert(worldRules).values(newWorldRule).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newWorldRule.storyId, currentUserId);
      await recordLocalOperation(db, newWorldRule.storyId, userIdToLog, 'create', 'WorldRule', newWorldRule.id, { ...newWorldRule }); // Pass serializable data

      return result;
    },

    async createChoice(currentUserId: string, choiceData: Create<ChoiceInsert>): Promise<ChoiceSelect> {
      const newChoice = prepareNewEntityData<ChoiceInsert>(choiceData);
      const result = await db.insert(choices).values(newChoice).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newChoice.storyId, currentUserId);
      await recordLocalOperation(db, newChoice.storyId, userIdToLog, 'create', 'Choice', newChoice.id, { ...newChoice }); // Pass serializable data

      return result;
    },

    async checkLinearCompatibility(storyId: string): Promise<LinearCompatibilityResult> {
      return checkLinearCompatibilityGraph(db, storyId);
    },

    async convertStoryType(currentUserId: string, storyId: string, targetType: 'linear' | 'branching'): Promise<void> {
      const story = await this.getStoryById(storyId);
      if (!story) {
        throw new Error(`Story with ID ${storyId} not found.`);
      }
      if (story.type === targetType) {
        return;
      }

      if (targetType === 'branching') {
        // Linear -> Branching: sempre permitido. Cada par de cenas consecutivas (por índice,
        // dentro do capítulo) vira uma Choice explícita, incluindo a ponte entre o fim de um
        // capítulo e o início do próximo - a mesma forma que a validação abaixo aceita na volta,
        // pra a conversão de ida e volta ser estável.
        const { storyChapters, storyScenes } = await loadStoryGraph(db, storyId);
        const nonEmptyChapters = groupScenesByChapter(storyChapters, storyScenes);

        for (const { scenes: chapterScenes } of nonEmptyChapters) {
          for (let i = 0; i < chapterScenes.length - 1; i++) {
            await this.createChoice(currentUserId, {
              storyId,
              sceneId: chapterScenes[i].id,
              nextSceneId: chapterScenes[i + 1].id,
              text: chapterScenes[i + 1].name,
            });
          }
        }
        for (let i = 0; i < nonEmptyChapters.length - 1; i++) {
          const lastSceneOfCurrent = nonEmptyChapters[i].scenes[nonEmptyChapters[i].scenes.length - 1];
          const firstSceneOfNext = nonEmptyChapters[i + 1].scenes[0];
          await this.createChoice(currentUserId, {
            storyId,
            sceneId: lastSceneOfCurrent.id,
            nextSceneId: firstSceneOfNext.id,
            text: firstSceneOfNext.name,
          });
        }

        await this.updateStory(currentUserId, storyId, { type: 'branching' });
        return;
      }

      // Branching -> Linear: só quando o grafo é compatível - a UI deve chamar
      // `checkLinearCompatibility` antes e nem oferecer esta conversão se não for; a checagem
      // aqui é só a rede de segurança contra uma corrida entre as duas chamadas.
      const compatibility = await checkLinearCompatibilityGraph(db, storyId);
      if (!compatibility.compatible) {
        throw new Error(
          `Story is not compatible with Linear conversion: ${compatibility.reasons.map((r) => `${r.chapterName} (${r.kind})`).join(', ')}`
        );
      }

      const { storyChapters, storyScenes, storyChoices } = await loadStoryGraph(db, storyId);
      const nonEmptyChapters = groupScenesByChapter(storyChapters, storyScenes);
      const { intraEdgesByChapter } = classifyEdges(nonEmptyChapters, storyChoices);

      const sceneService = createSceneService(db);
      const choiceService = createChoiceService(db);

      const sceneUpdates: { sceneId: string; changes: { index: number } }[] = [];
      for (const { chapter, scenes: chapterScenes } of nonEmptyChapters) {
        const intraEdges = intraEdgesByChapter.get(chapter.id) ?? [];
        const order = computeChapterChainOrder(chapterScenes, intraEdges);
        const sceneById = new Map(chapterScenes.map((s) => [s.id, s]));
        order.forEach((sceneId, newIndex) => {
          const scene = sceneById.get(sceneId)!;
          if (scene.index !== newIndex) {
            sceneUpdates.push({ sceneId, changes: { index: newIndex } });
          }
        });
      }
      if (sceneUpdates.length > 0) {
        await sceneService.batchUpdateScenes(currentUserId, storyId, sceneUpdates);
      }

      // Todas as escolhas somem na conversão pra Linear - o modo linear nunca guarda dados de
      // navegação por Choice, e uma futura reconversão pra Branching gera escolhas novas a
      // partir da ordem das cenas (ver o ramo acima).
      const remainingChoices = await db.select({ id: choices.id }).from(choices)
        .where(and(eq(choices.storyId, storyId), eq(choices.isDeleted, false))).all();
      for (const choice of remainingChoices) {
        await choiceService.deleteChoice(currentUserId, choice.id);
      }

      await this.updateStory(currentUserId, storyId, { type: 'linear' });
    },

    async updateStoryFavoriteStatus(currentUserId: string, storyId: string, isFavorite: boolean): Promise<void> {
      const originalStory = await this.getStoryById(storyId);

      if (!originalStory) {
        throw new Error(`Story with ID ${storyId} not found.`);
      }

      // If the favorite status hasn't actually changed, skip the update and logging
      if (originalStory.isFavorite === isFavorite) {
        console.log(`Story ${storyId} favorite status is already ${isFavorite}. Skipping update and operation log.`);
        return;
      }
      await assertStoryIsWritable(db, storyId);

      const [updatedStory] = await db.update(stories)
        .set({ isFavorite, updatedAt: new Date(), version: sql`${stories.version} + 1` })
        .where(eq(stories.id, storyId))
        .returning({ isFavorite: stories.isFavorite, version: stories.version });

      if (!updatedStory) {
        throw new Error(`Failed to update favorite status for story ${storyId} or story not found.`);
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

      // Story deletion is always permanent and always local-first (see purgeStoryLocally).
      // If the story is attached to a server, make a best-effort attempt to tell it first
      // - so its own copy gets soft-deleted there too and stays recoverable - but a
      // failed/offline attempt never blocks the local purge; deleting a story here is the
      // end of it on this device regardless of connectivity.
      if (storyToDelete.serverId) {
        const server = await db.query.servers.findFirst({ where: eq(servers.id, storyToDelete.serverId) });
        if (server?.url) {
          try {
            const client = createKeresAxiosInstance({ baseURL: server.url });
            client.setTokenProvider(authTokenManager);
            client.setActiveServer(server);
            // Sem `version`: o objetivo aqui é apagar independente do que o servidor ache que
            // é a versão atual (o local já decidiu apagar, incondicionalmente) - mandar a
            // versão local faria o servidor tratar quase toda chamada como conflito de
            // concorrência (`checkVersionConflict`) e devolver 200 sem aplicar nada, porque o
            // contador local de versão nunca ficou de fato em lockstep com o do servidor.
            // Sem `operationTime` também: o servidor recusa qualquer horário mais de 1s à
            // frente do próprio relógio dele (`parseOperationTime`), e o relógio do
            // aparelho/emulador não tem garantia nenhuma de estar sincronizado com o do
            // servidor. Omitir deixa o servidor usar o `new Date()` dele mesmo - o único
            // relógio que essa checagem pode comparar com segurança.
            const response = await client.post(`/sync/${storyId}`, [{
              entity: 'Story',
              id: storyId,
              type: 'delete',
            }]);
            const conflict = (response.data?.conflicts as Array<{ entity: string; entityId: string; message?: string; reason?: string }> | undefined)
              ?.find((c) => c.entity === 'Story' && c.entityId === storyId);
            if (conflict) {
              console.warn(`Server rejected deletion for story ${storyId} (proceeding with local deletion regardless): ${conflict.message || conflict.reason}`);
            }
          } catch (err) {
            if (!isOfflineError(err)) {
              console.warn(`Failed to notify server of deletion for story ${storyId} (proceeding with local deletion regardless):`, (err as Error)?.message || err);
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

      const server = await db.query.servers.findFirst({ where: eq(servers.id, story.serverId) });
      if (!server?.url) {
        // The server row itself is gone locally - nothing to notify, just drop the stale link.
        await this.updateStory(currentUserId, storyId, { serverId: null });
        return;
      }

      // Unlike deleteStory's best-effort notification (the local purge happens regardless of
      // connectivity), this one has to succeed - it's the only thing that actually removes the
      // story's data from the server, which is the whole point of taking it offline. The
      // caller (UI) is expected to have already confirmed ownership and zero collaborators
      // before offering this action at all.
      //
      // No `version` in the payload, same reasoning as deleteStory: local `stories.version`
      // was never kept in lockstep with the server's copy (nothing pushes plain Story-field
      // edits through a version-checked path today), so sending it would make the server
      // reject this as a concurrency conflict almost every time - a 200 response whose
      // `conflicts` array says the delete never actually applied, silently defeating the
      // whole point of this action. Omitting it opts into last-write-wins on the server
      // (`checkVersionConflict` short-circuits when the client doesn't state a base version),
      // which is exactly the semantics wanted here: this action means "delete it, whatever
      // state it's in."
      //
      // No `operationTime` either: the server rejects any timestamp more than 1s ahead of
      // its own clock (`parseOperationTime`), and a device/emulator's clock has no guarantee
      // of being in sync with the server's. Omitting it lets the server fall back to its own
      // `new Date()` - the only clock this check can safely compare against.
      const client = createKeresAxiosInstance({ baseURL: server.url });
      client.setTokenProvider(authTokenManager);
      client.setActiveServer(server);
      const response = await client.post(`/sync/${storyId}`, [{
        entity: 'Story',
        id: storyId,
        type: 'delete',
      }]);

      // The route always answers 200 and reports per-operation outcome in the body - a
      // rejected operation never throws, so this check is the only way to actually know
      // whether the server's copy is gone.
      const conflict = (response.data?.conflicts as Array<{ entity: string; entityId: string; message?: string; reason?: string }> | undefined)
        ?.find((c) => c.entity === 'Story' && c.entityId === storyId);
      if (conflict) {
        throw new Error(`Server rejected the delete: ${conflict.message || conflict.reason || 'unknown reason'}`);
      }

      await this.updateStory(currentUserId, storyId, { serverId: null });
    },

    async getBranchingStoryForkCount(): Promise<number> {
      const result = await db.select({
        count: count(scenes.id)
      })
        .from(scenes)
        .innerJoin(stories, eq(scenes.storyId, stories.id))
        .leftJoin(choices, eq(scenes.id, choices.sceneId))
        .where(and(eq(stories.type, 'branching'), eq(stories.isDeleted, false)))
        .groupBy(scenes.id)
        .having(sql`count(${choices.id}) > 1`)
        .all();

      return result.length;
    },

    /**
     * Monta o pacote completo de uma história a partir do banco local.
     *
     * É a contraparte de `importFullStory` e usa a mesma forma (`FullStoryExportSchema`)
     * que o servidor, então um arquivo exportado aqui pode ser importado lá e vice-versa.
     *
     * Registros marcados como excluídos ficam de fora: o pacote representa a história como
     * ela é, não o histórico de como chegou até aqui.
     */
    async exportFullStory(storyId: string): Promise<FullStoryExportType> {
      const story = await db.select().from(stories).where(eq(stories.id, storyId)).get();
      if (!story) {
        throw new Error(`Story with ID ${storyId} not found for export.`);
      }

      const belongsToStory = (table: { storyId: any; isDeleted: any }) =>
        and(eq(table.storyId, storyId), eq(table.isDeleted, false));

      const [
        storyChapters, storyScenes, storyChoices, storyCharacters, storyLocations,
        storyLocationRelations,
        storyWorldRules, storyNotes, storyNoteRelations, storyTags, storyTagRelations,
        storySuggestions, storyCharacterRelations, storyCharacterScenes, storyGalleryItems,
        storyGalleryRelations, storyItems, storyItemJourneys,
        storySchemaFieldRows, storyAttributeValues,
      ] = await Promise.all([
        db.query.chapters.findMany({ where: belongsToStory(chapters) }),
        db.query.scenes.findMany({ where: belongsToStory(scenes) }),
        db.query.choices.findMany({ where: belongsToStory(choices) }),
        db.query.characters.findMany({ where: belongsToStory(characters) }),
        db.query.locations.findMany({ where: belongsToStory(locations) }),
        db.query.locationRelations.findMany({ where: belongsToStory(locationRelations) }),
        db.query.worldRules.findMany({ where: belongsToStory(worldRules) }),
        db.query.notes.findMany({ where: belongsToStory(notes) }),
        db.query.noteRelations.findMany({ where: belongsToStory(noteRelations) }),
        db.query.tags.findMany({ where: belongsToStory(tags) }),
        db.query.tagRelations.findMany({ where: belongsToStory(tagRelations) }),
        db.query.suggestions.findMany({ where: belongsToStory(suggestions) }),
        db.query.characterRelations.findMany({ where: belongsToStory(characterRelations) }),
        db.query.characterScenes.findMany({ where: belongsToStory(characterScenes) }),
        db.query.galleries.findMany({ where: belongsToStory(galleries) }),
        db.query.galleryRelations.findMany({ where: belongsToStory(galleryRelations) }),
        db.query.items.findMany({ where: belongsToStory(items) }),
        db.query.itemJourneys.findMany({ where: belongsToStory(itemJourneys) }),
        db.query.storySchemaFields.findMany({ where: belongsToStory(storySchemaFields) }),
        db.query.attributeValues.findMany({ where: belongsToStory(attributeValues) }),
      ]);

      return FullStoryExportSchema.parse({
        story,
        chapters: storyChapters,
        scenes: storyScenes,
        choices: storyChoices,
        characters: storyCharacters,
        locations: storyLocations,
        locationRelations: storyLocationRelations,
        worldRules: storyWorldRules,
        notes: storyNotes,
        noteRelations: storyNoteRelations,
        tags: storyTags,
        tagRelations: storyTagRelations,
        suggestions: storySuggestions,
        // A tabela local chama os lados da relação de `charId1`/`charId2`, mas o formato de
        // arquivo (e o servidor) usa `character1Id`/`character2Id`. `importFullStory` faz a
        // tradução na entrada; sem a simétrica aqui, o arquivo gerado seria recusado na
        // volta.
        characterRelations: storyCharacterRelations.map(relation => ({
          ...relation,
          character1Id: relation.charId1,
          character2Id: relation.charId2,
        })),
        characterScenes: storyCharacterScenes,
        galleryItems: storyGalleryItems,
        galleryRelations: storyGalleryRelations,
        items: storyItems,
        itemJourneys: storyItemJourneys,
        storySchemaFields: storySchemaFieldRows,
        attributeValues: storyAttributeValues,
        // O importador usa este número como ponto de partida da sincronização. Preservar o
        // marcador local mantém o pacote útil para uma história já ligada a um servidor.
        serverLastOperationVersion: story.lastServerSyncedLog || 0,
        formatVersion: CURRENT_STORY_FORMAT_VERSION,
      });
    },

    async importFullStory(userId: string, fullStoryData: FullStoryExportType, queriedServerId: string | null, role: EffectiveStoryRole | null = null, localMediaPaths?: Map<string, string>): Promise<string> {
      return db.transaction(async (tx) => {
        // Defensive: the caller already confirmed there's no `stories` row for this id (the
        // "already imported" check in ImportExportScreen/ExampleStoryService), but that alone
        // doesn't guarantee a clean slate - orphaned child rows from an interrupted import or
        // a deletion made before deleteStoryChildRows covered every table would collide with
        // the fresh inserts below (e.g. a stale locationRelations row hitting its UNIQUE
        // constraint on id). Clearing first makes a retry self-healing either way.
        await deleteStoryChildRows(tx, fullStoryData.story.id);

        // 1. Process Story
        const originalStory = fullStoryData.story;
        const storyToInsert: StoryInsert = {
          ...originalStory,
          userId: userId, // Assign to the current user
          createdAt: new Date(originalStory.createdAt), // Use original creation date if available
          updatedAt: new Date(), // Set current update date
          version: originalStory.version, // Use original version
          isDeleted: false, // Ensure it's not deleted locally upon import
          deletedAt: null, // Ensure it's not deleted locally upon import
          lastOperationLog: fullStoryData.serverLastOperationVersion, // Use the server's current operation version
          lastServerSyncedLog: fullStoryData.serverLastOperationVersion,
          serverId: queriedServerId,
          // Known synchronously here (from the caller's already-fetched pullpreviews role) so
          // this row never exists server-linked with an unknown role - see useStoryRole/
          // assertStoryIsWritable, which fail closed on an unknown role for a server-linked story.
          myRole: queriedServerId ? role : null,
        };
        await tx.insert(stories).values(storyToInsert).run();

        // 2. Process Chapters
        for (const chapter of fullStoryData.chapters) {
          const chapterToInsert: ChapterInsert = {
            ...chapter,
            storyId: chapter.storyId,
            createdAt: new Date(chapter.createdAt),
            updatedAt: new Date(),
            version: chapter.version,
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(chapters).values(chapterToInsert).run();
        }

        // 3. Process Scenes
        for (const scene of fullStoryData.scenes) {
          const sceneToInsert: SceneInsert = {
            ...scene,
            storyId: scene.storyId,
            chapterId: scene.chapterId,
            locationId: scene.locationId,
            createdAt: new Date(scene.createdAt),
            updatedAt: new Date(),
            version: scene.version,
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(scenes).values(sceneToInsert).run();
        }

        // Post-import cleanup for linear stories: Ensure only one isStart and isFinish
        if (storyToInsert.type === 'linear') {
          const importedScenes = await tx.query.scenes.findMany({
            where: eq(scenes.storyId, storyToInsert.id),
            columns: { id: true, isStart: true, isFinish: true, version: true },
          });

          const now = new Date(); // Use a single timestamp for these cleanup updates

          let firstIsStartFound = false;
          for (const scene of importedScenes) {
            if (scene.isStart && !firstIsStartFound) {
              firstIsStartFound = true;
            } else if (scene.isStart && firstIsStartFound) {
              // This is a duplicate isStart, unset it
              await tx.update(scenes)
                .set({ isStart: false, updatedAt: now, version: scene.version + 1 })
                .where(eq(scenes.id, scene.id));
            }
          }

          let firstIsFinishFound = false;
          for (const scene of importedScenes) {
            if (scene.isFinish && !firstIsFinishFound) {
              firstIsFinishFound = true;
            } else if (scene.isFinish && firstIsFinishFound) {
              // This is a duplicate isFinish, unset it
              await tx.update(scenes)
                .set({ isFinish: false, updatedAt: now, version: scene.version + 1 })
                .where(eq(scenes.id, scene.id));
            }
          }
        }


        // 4. Process Choices
        for (const choice of fullStoryData.choices) {
          const choiceToInsert: ChoiceInsert = {
            ...choice,
            storyId: choice.storyId,
            sceneId: choice.sceneId,
            nextSceneId: choice.nextSceneId,
            createdAt: new Date(choice.createdAt),
            updatedAt: new Date(),
            version: choice.version,
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(choices).values(choiceToInsert).run();
        }

        // 5. Process Characters
        for (const character of fullStoryData.characters) {
          const characterToInsert: CharacterInsert = {
            ...character,
            storyId: character.storyId,
            createdAt: new Date(character.createdAt),
            updatedAt: new Date(),
            version: character.version,
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(characters).values(characterToInsert).run();
        }

        // 6. Process Locations
        for (const location of fullStoryData.locations) {
          const locationToInsert: LocationInsert = {
            ...location,
            storyId: location.storyId,
            createdAt: new Date(location.createdAt),
            updatedAt: new Date(),
            version: location.version,
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(locations).values(locationToInsert).run();
        }

        // 6.1 Process LocationRelations (Optional) - depois de Locations de propósito, ver
        // comentário equivalente em StoryExportImportService.ts (API).
        if (fullStoryData.locationRelations) {
          for (const locationRelation of fullStoryData.locationRelations) {
            const locationRelationToInsert: LocationRelationInsert = {
              ...locationRelation,
              storyId: locationRelation.storyId,
              createdAt: new Date(locationRelation.createdAt),
              updatedAt: new Date(),
              version: locationRelation.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(locationRelations).values(locationRelationToInsert).run();
          }
        }

        // 7. Process WorldRules
        for (const worldRule of fullStoryData.worldRules) {
          const worldRuleToInsert: WorldRuleInsert = {
            ...worldRule,
            storyId: worldRule.storyId,
            createdAt: new Date(worldRule.createdAt),
            updatedAt: new Date(),
            version: worldRule.version,
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(worldRules).values(worldRuleToInsert).run();
        }

        // 8. Process Notes
        for (const note of fullStoryData.notes) {
          const noteToInsert: NoteInsert = {
            ...note,
            storyId: note.storyId,
            createdAt: new Date(note.createdAt),
            updatedAt: new Date(),
            version: note.version,
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(notes).values(noteToInsert).run();
        }

        // 9. Process Tags
        for (const tag of fullStoryData.tags) {
          const tagToInsert: TagInsert = {
            ...tag,
            storyId: tag.storyId,
            createdAt: new Date(tag.createdAt),
            updatedAt: new Date(),
            version: tag.version,
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(tags).values(tagToInsert).run();
        }

        // 10. Process Suggestions
        for (const suggestion of fullStoryData.suggestions) {
          const suggestionToInsert: SuggestionInsert = {
            ...suggestion,
            storyId: suggestion.storyId,
            createdAt: new Date(suggestion.createdAt),
            updatedAt: new Date(),
            version: suggestion.version,
            isDeleted: false,
            isDefault: suggestion.isDefault,
            deletedAt: null,
          };
          await tx.insert(suggestions).values(suggestionToInsert).run();
        }

        // 11. Process CharacterRelations
        for (const charRelation of fullStoryData.characterRelations) {
          const charRelationToInsert: CharacterRelationInsert = {
            ...charRelation,
            storyId: charRelation.storyId,
            charId1: charRelation.character1Id,
            charId2: charRelation.character2Id,
            createdAt: new Date(charRelation.createdAt),
            updatedAt: new Date(),
            version: charRelation.version,
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(characterRelations).values(charRelationToInsert).run();
        }

        // 12. Process CharacterScenes
        for (const charScene of fullStoryData.characterScenes) {
          const charSceneToInsert: CharacterSceneInsert = {
            ...charScene,
            storyId: charScene.storyId,
            characterId: charScene.characterId,
            sceneId: charScene.sceneId,
            createdAt: new Date(charScene.createdAt),
            updatedAt: new Date(),
            version: charScene.version,
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(characterScenes).values(charSceneToInsert).run();
        }
        
        // 13. Process TagRelations
        if (fullStoryData.tagRelations) {
          for (const tagRelation of fullStoryData.tagRelations) {
            const tagRelationToInsert: TagRelationInsert = {
              ...tagRelation,
              storyId: tagRelation.storyId,
              tagId: tagRelation.tagId,
              relationId: tagRelation.relationId,
              relationType: tagRelation.relationType,
              createdAt: new Date(tagRelation.createdAt),
              updatedAt: new Date(),
              version: tagRelation.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(tagRelations).values(tagRelationToInsert).run();
          }
        }
        
        // 14. Process GalleryItems
        if (fullStoryData.galleryItems) {
          for (const galleryItem of fullStoryData.galleryItems) {
            // Um pacote `.zip` já trouxe os bytes desta mídia para o aparelho antes desta
            // transação começar (ver `ImportExportScreen.handleImport`); um `.json` puro
            // carrega só os metadados, e os bytes ficam no servidor, endereçados pelo hash.
            const localPath = localMediaPaths?.get(galleryItem.hash);
            const galleryItemToInsert: GalleryInsert = {
              ...galleryItem,
              storyId: galleryItem.storyId,
              createdAt: new Date(galleryItem.createdAt),
              updatedAt: new Date(),
              version: galleryItem.version,
              isDeleted: false,
              deletedAt: null,
              localPath: localPath ?? null,
              // Com o arquivo já aqui, falta subir para o servidor (se/quando a história
              // for vinculada a um); sem ele, falta baixar - a sincronização decide sozinha
              // com base nestes dois estados.
              uploadState: localPath ? 'pending' : 'uploaded',
              downloadState: localPath ? 'downloaded' : 'pending',
            };
            await tx.insert(galleries).values(galleryItemToInsert).run();
          }
        }

        // 14b. Process GalleryRelations
        if (fullStoryData.galleryRelations) {
          for (const galleryRelation of fullStoryData.galleryRelations) {
            const galleryRelationToInsert: GalleryRelationInsert = {
              ...galleryRelation,
              storyId: galleryRelation.storyId,
              createdAt: new Date(galleryRelation.createdAt),
              updatedAt: new Date(),
              version: galleryRelation.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(galleryRelations).values(galleryRelationToInsert).run();
          }
        }


        // 15. Process Items (if optional) - Assuming there's an 'items' table
        if (fullStoryData.items) {
          for (const item of fullStoryData.items) {
            const itemToInsert: ItemInsert = {
              ...item,
              storyId: item.storyId,
              characterOwnerId: item.characterOwnerId,
              createdAt: new Date(item.createdAt),
              updatedAt: new Date(),
              version: item.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(items).values(itemToInsert).run();
          }
        }
        
        // 16. Process ItemJourneys - Assuming there's an 'itemJourneys' table
        if (fullStoryData.itemJourneys) {
          for (const itemJourney of fullStoryData.itemJourneys) {
            const itemJourneyToInsert: ItemJourneyInsert = {
              ...itemJourney,
              storyId: itemJourney.storyId,
              itemId: itemJourney.itemId,
              sceneId: itemJourney.sceneId,
              newCharacterOwnerId: itemJourney.newCharacterOwnerId,
              createdAt: new Date(itemJourney.createdAt),
              updatedAt: new Date(),
              version: itemJourney.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(itemJourneys).values(itemJourneyToInsert).run();
          }
        }
        
        // 17. Process NoteRelations
        if (fullStoryData.noteRelations) {
          for (const noteRelation of fullStoryData.noteRelations) {
            const noteRelationToInsert: NoteRelationInsert = {
              ...noteRelation,
              storyId: noteRelation.storyId,
              noteId: noteRelation.noteId,
              relationId: noteRelation.relationId,
              relationType: noteRelation.relationType,
              createdAt: new Date(noteRelation.createdAt),
              updatedAt: new Date(),
              version: noteRelation.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(noteRelations).values(noteRelationToInsert).run();
          }
        }

        // 18. Process StorySchemaFields (Optional)
        if (fullStoryData.storySchemaFields) {
          for (const field of fullStoryData.storySchemaFields) {
            const fieldToInsert: StorySchemaFieldInsert = {
              ...field,
              storyId: field.storyId,
              createdAt: new Date(field.createdAt),
              updatedAt: new Date(),
              version: field.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(storySchemaFields).values(fieldToInsert).run();
          }
        }

        // 19. Process AttributeValues (Optional) - por último de propósito: entityId pode
        // apontar pra qualquer um dos 7 tipos de entidade suportados, todos já inseridos acima,
        // e fieldId depende do bloco de StorySchemaFields logo acima. IDs preservados como
        // vieram do arquivo (sem idMap, mesmo tratamento de todo bloco anterior neste método).
        if (fullStoryData.attributeValues) {
          for (const attributeValue of fullStoryData.attributeValues) {
            const attributeValueToInsert: AttributeValueInsert = {
              ...attributeValue,
              storyId: attributeValue.storyId,
              fieldId: attributeValue.fieldId,
              entityId: attributeValue.entityId,
              createdAt: new Date(attributeValue.createdAt),
              updatedAt: new Date(),
              version: attributeValue.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(attributeValues).values(attributeValueToInsert).run();
          }
        }

        return originalStory.id; // Return the original story ID
      });
    },
  };
};