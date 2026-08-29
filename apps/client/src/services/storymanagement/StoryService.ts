import type { EffectiveStoryRole, FullStoryExportType } from '@keres/shared';
import {
  assertStoryExportIntegrity,
  CURRENT_STORY_FORMAT_VERSION,
  pruneDanglingStoryExportRows,
  FullStoryExportSchema,
  scenesToUnflag,
  STORY_OWNER_ONLY_FIELDS,
} from '@keres/shared';
import { and, count, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type {
  AttributeValueInsert,
  ChapterInsert,
  ChapterSelect,
  CharacterInsert,
  CharacterRelationInsert,
  CharacterSceneInsert,
  CharacterSelect,
  ChoiceCheckGroupInsert,
  ChoiceCheckInsert,
  ChoiceInsert,
  ChoiceSelect,
  CommentInsert,
  EffectInsert,
  GalleryInsert,
  GalleryRelationInsert,
  ItemInsert,
  ItemJourneyInsert,
  LocationInsert,
  LocationRelationInsert,
  LocationSelect,
  NoteInsert,
  NoteRelationInsert,
  NoteSelect,
  PlotInsert,
  PlotSceneInsert,
  SceneInsert,
  SceneSelect,
  SeeAlsoRelationInsert,
  StoryInsert,
  StorySelect,
  StorySchemaFieldInsert,
  ModeInsert,
  StatInsert,
  StatRelationInsert,
  StatStrengthInsert,
  SuggestionInsert,
  TagInsert,
  TagRelationInsert,
  WorldRuleInsert,
  WorldRuleSelect,
} from '../../db/schema';
import {
  attributeValues,
  chapters,
  chapterAnchors,
  boards,
  storyCalendars,
  characterRelations,
  characters,
  characterScenes,
  choiceCheckGroups,
  choiceChecks,
  choices,
  comments,
  effects,
  galleries,
  favorites,
  galleryRelations,
  itemJourneys,
  items,
  locations,
  locationMaps,
  locationRelations,
  noteRelations,
  notes,
  plots,
  plotScenes,
  scenes,
  seeAlsoRelations,
  servers,
  stories,
  modes,
  statRelations,
  stats,
  statStrengths,
  storySchemaFields,
  suggestions,
  tagRelations,
  tags,
  worldRules,
} from '../../db/schema';
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
import { createSceneService } from './SceneService';
import { createFavoriteService } from './FavoriteService';
import { cloneStoryForLocalImport } from './cloneStoryForLocalImport';
import { deleteStoryChildRows, purgeStoryLocally } from './storyLocalPurge';
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
  getCustomAttributeCount(storyId?: string): Promise<number>;

  // New creation methods using Create<T>
  createCharacter(
    currentUserId: string,
    characterData: Create<CharacterInsert>,
  ): Promise<CharacterSelect>;
  createChapter(currentUserId: string, chapterData: Create<ChapterInsert>): Promise<ChapterSelect>;
  createLocation(
    currentUserId: string,
    locationData: Create<LocationInsert>,
  ): Promise<LocationSelect>;
  createScene(currentUserId: string, sceneData: Create<SceneInsert>): Promise<SceneSelect>;
  createNote(currentUserId: string, noteData: Create<NoteInsert>): Promise<NoteSelect>;
  createWorldRule(
    currentUserId: string,
    worldRuleData: Create<WorldRuleInsert>,
  ): Promise<WorldRuleSelect>;
  createChoice(currentUserId: string, choiceData: Create<ChoiceInsert>): Promise<ChoiceSelect>;

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
  getBranchingStoryForkCount(storyId?: string): Promise<number>;
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

    async getStoryCounts(): Promise<{ totalStories: number; branchingStories: number }> {
      const totalStoriesResult = await db
        .select({ count: count() })
        .from(stories)
        .where(eq(stories.isDeleted, false))
        .get();
      const branchingStoriesResult = await db
        .select({ count: count() })
        .from(stories)
        .where(and(eq(stories.type, 'branching'), eq(stories.isDeleted, false)))
        .get();
      return {
        totalStories: totalStoriesResult?.count || 0,
        branchingStories: branchingStoriesResult?.count || 0,
      };
    },

    async getCharacterCount(storyId?: string): Promise<number> {
      const result = await db
        .select({ count: count() })
        .from(characters)
        .innerJoin(stories, eq(characters.storyId, stories.id))
        .where(
          storyId
            ? and(
                eq(characters.storyId, storyId),
                eq(stories.isDeleted, false),
                eq(characters.isDeleted, false),
              )
            : and(eq(stories.isDeleted, false), eq(characters.isDeleted, false)),
        )
        .get();
      return result?.count || 0;
    },

    async getChoiceCount(storyId?: string): Promise<number> {
      const result = await db
        .select({ count: count() })
        .from(choices)
        .innerJoin(scenes, eq(choices.sceneId, scenes.id))
        .innerJoin(stories, eq(scenes.storyId, stories.id))
        .where(
          storyId
            ? and(
                eq(stories.id, storyId),
                eq(stories.isDeleted, false),
                eq(scenes.isDeleted, false),
                eq(choices.isDeleted, false),
              )
            : and(
                eq(stories.isDeleted, false),
                eq(scenes.isDeleted, false),
                eq(choices.isDeleted, false),
              ),
        )
        .get();
      return result?.count || 0;
    },

    async getLocationCount(storyId?: string): Promise<number> {
      const result = await db
        .select({ count: count() })
        .from(locations)
        .innerJoin(stories, eq(locations.storyId, stories.id))
        .where(
          storyId
            ? and(
                eq(stories.id, storyId),
                eq(stories.isDeleted, false),
                eq(locations.isDeleted, false),
              )
            : and(eq(stories.isDeleted, false), eq(locations.isDeleted, false)),
        )
        .get();
      return result?.count || 0;
    },

    async getChapterCount(storyId?: string): Promise<number> {
      const result = await db
        .select({ count: count() })
        .from(chapters)
        .innerJoin(stories, eq(chapters.storyId, stories.id))
        .where(
          storyId
            ? and(
                eq(chapters.storyId, storyId),
                eq(stories.isDeleted, false),
                eq(chapters.isDeleted, false),
              )
            : and(eq(stories.isDeleted, false), eq(chapters.isDeleted, false)),
        )
        .get();
      return result?.count || 0;
    },

    async getSceneCount(storyId?: string): Promise<number> {
      const result = await db
        .select({ count: count() })
        .from(scenes)
        .innerJoin(stories, eq(scenes.storyId, stories.id))
        .where(
          storyId
            ? and(
                eq(stories.id, storyId),
                eq(stories.isDeleted, false),
                eq(scenes.isDeleted, false),
              )
            : and(eq(stories.isDeleted, false), eq(scenes.isDeleted, false)),
        )
        .get();
      return result?.count || 0;
    },

    async getNoteCount(storyId?: string): Promise<number> {
      const result = await db
        .select({ count: count() })
        .from(notes)
        .innerJoin(stories, eq(notes.storyId, stories.id))
        .where(
          storyId
            ? and(eq(stories.id, storyId), eq(stories.isDeleted, false), eq(notes.isDeleted, false))
            : and(eq(stories.isDeleted, false), eq(notes.isDeleted, false)),
        )
        .get();
      return result?.count || 0;
    },

    async getWorldRuleCount(storyId?: string): Promise<number> {
      const result = await db
        .select({ count: count() })
        .from(worldRules)
        .innerJoin(stories, eq(worldRules.storyId, stories.id))
        .where(
          storyId
            ? and(
                eq(stories.id, storyId),
                eq(stories.isDeleted, false),
                eq(worldRules.isDeleted, false),
              )
            : and(eq(stories.isDeleted, false), eq(worldRules.isDeleted, false)),
        )
        .get();
      return result?.count || 0;
    },

    async getItemCount(storyId?: string): Promise<number> {
      const result = await db
        .select({ count: count() })
        .from(items)
        .innerJoin(stories, eq(items.storyId, stories.id))
        .where(
          storyId
            ? and(
                eq(items.storyId, storyId),
                eq(stories.isDeleted, false),
                eq(items.isDeleted, false),
              )
            : and(eq(stories.isDeleted, false), eq(items.isDeleted, false)),
        )
        .get();
      return result?.count || 0;
    },

    async getGalleryCount(storyId?: string): Promise<number> {
      const result = await db
        .select({ count: count() })
        .from(galleries)
        .innerJoin(stories, eq(galleries.storyId, stories.id))
        .where(
          storyId
            ? and(
                eq(galleries.storyId, storyId),
                eq(stories.isDeleted, false),
                eq(galleries.isDeleted, false),
              )
            : and(eq(stories.isDeleted, false), eq(galleries.isDeleted, false)),
        )
        .get();
      return result?.count || 0;
    },

    async getTagCount(storyId?: string): Promise<number> {
      const result = await db
        .select({ count: count() })
        .from(tags)
        .innerJoin(stories, eq(tags.storyId, stories.id))
        .where(
          storyId
            ? and(
                eq(tags.storyId, storyId),
                eq(stories.isDeleted, false),
                eq(tags.isDeleted, false),
              )
            : and(eq(stories.isDeleted, false), eq(tags.isDeleted, false)),
        )
        .get();
      return result?.count || 0;
    },

    async getCustomAttributeCount(storyId?: string): Promise<number> {
      const result = await db
        .select({ count: count() })
        .from(storySchemaFields)
        .innerJoin(stories, eq(storySchemaFields.storyId, stories.id))
        .where(
          storyId
            ? and(
                eq(storySchemaFields.storyId, storyId),
                eq(stories.isDeleted, false),
                eq(storySchemaFields.isDeleted, false),
              )
            : and(eq(stories.isDeleted, false), eq(storySchemaFields.isDeleted, false)),
        )
        .get();
      return result?.count || 0;
    },

    async createCharacter(
      currentUserId: string,
      characterData: Create<CharacterInsert>,
    ): Promise<CharacterSelect> {
      const newCharacter = prepareNewEntityData<CharacterInsert>(characterData);
      const result = await db.insert(characters).values(newCharacter).returning().get();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newCharacter.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        newCharacter.storyId,
        userIdToLog,
        'create',
        'Character',
        newCharacter.id,
        { ...newCharacter },
      ); // Pass serializable data

      return result;
    },

    async createChapter(
      currentUserId: string,
      chapterData: Create<ChapterInsert>,
    ): Promise<ChapterSelect> {
      const newChapter = prepareNewEntityData<ChapterInsert>(chapterData);
      const result = await db.insert(chapters).values(newChapter).returning().get();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newChapter.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        newChapter.storyId,
        userIdToLog,
        'create',
        'Chapter',
        newChapter.id,
        { ...newChapter },
      ); // Pass serializable data

      return result;
    },

    async createLocation(
      currentUserId: string,
      locationData: Create<LocationInsert>,
    ): Promise<LocationSelect> {
      const newLocation = prepareNewEntityData<LocationInsert>(locationData);
      const result = await db.insert(locations).values(newLocation).returning().get();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newLocation.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        newLocation.storyId,
        userIdToLog,
        'create',
        'Location',
        newLocation.id,
        { ...newLocation },
      ); // Pass serializable data

      return result;
    },

    async createScene(currentUserId: string, sceneData: Create<SceneInsert>): Promise<SceneSelect> {
      const newScene = prepareNewEntityData<SceneInsert>(sceneData);
      const result = await db.insert(scenes).values(newScene).returning().get();

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
        { ...newScene },
      ); // Pass serializable data

      return result;
    },

    async createNote(currentUserId: string, noteData: Create<NoteInsert>): Promise<NoteSelect> {
      const newNote = prepareNewEntityData<NoteInsert>(noteData);
      const result = await db.insert(notes).values(newNote).returning().get();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newNote.storyId,
        currentUserId,
      );
      await recordLocalOperation(db, newNote.storyId, userIdToLog, 'create', 'Note', newNote.id, {
        ...newNote,
      }); // Pass serializable data

      return result;
    },

    async createWorldRule(
      currentUserId: string,
      worldRuleData: Create<WorldRuleInsert>,
    ): Promise<WorldRuleSelect> {
      const newWorldRule = prepareNewEntityData<WorldRuleInsert>(worldRuleData);
      const result = await db.insert(worldRules).values(newWorldRule).returning().get();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newWorldRule.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        newWorldRule.storyId,
        userIdToLog,
        'create',
        'WorldRule',
        newWorldRule.id,
        { ...newWorldRule },
      ); // Pass serializable data

      return result;
    },

    async createChoice(
      currentUserId: string,
      choiceData: Create<ChoiceInsert>,
    ): Promise<ChoiceSelect> {
      const newChoice = prepareNewEntityData<ChoiceInsert>(choiceData);
      const result = await db.insert(choices).values(newChoice).returning().get();

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newChoice.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        newChoice.storyId,
        userIdToLog,
        'create',
        'Choice',
        newChoice.id,
        { ...newChoice },
      ); // Pass serializable data

      return result;
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
        const row = await db
          .select({ count: count() })
          .from(plots)
          .where(and(eq(plots.storyId, storyId), eq(plots.isDeleted, false)))
          .get();
        if ((row?.count ?? 0) > 0) {
          throw new Error('Remove all plots before converting this story to branching.');
        }
        // Linear -> Branching: always allowed. Each pair of consecutive scenes (by index,
        // within the chapter) becomes an explicit Choice, including the bridge between the end of one
        // chapter and the start of the next - the same shape the validation below accepts on the way back,
        // so the round-trip conversion is stable.
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
          const lastSceneOfCurrent =
            nonEmptyChapters[i].scenes[nonEmptyChapters[i].scenes.length - 1];
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

      const sceneService = createSceneService(db);
      const choiceService = createChoiceService(db);

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

    async getBranchingStoryForkCount(storyId?: string): Promise<number> {
      const result = await db
        .select({
          count: count(scenes.id),
        })
        .from(scenes)
        .innerJoin(stories, eq(scenes.storyId, stories.id))
        .leftJoin(choices, and(eq(scenes.id, choices.sceneId), eq(choices.isDeleted, false)))
        .where(
          storyId
            ? and(
                eq(stories.id, storyId),
                eq(stories.type, 'branching'),
                eq(stories.isDeleted, false),
                eq(scenes.isDeleted, false),
              )
            : and(
                eq(stories.type, 'branching'),
                eq(stories.isDeleted, false),
                eq(scenes.isDeleted, false),
              ),
        )
        .groupBy(scenes.id)
        .having(sql`count(${choices.id}) > 1`)
        .all();

      return result.length;
    },

    /**
     * Assembles a story's complete package from the local database.
     *
     * It is `importFullStory`'s counterpart and uses the same shape (`FullStoryExportSchema`)
     * as the server, so a file exported here can be imported there and vice versa.
     *
     * Records marked as deleted are left out: the package represents the story as
     * it is, not the history of how it got here.
     */
    async exportFullStory(storyId: string): Promise<FullStoryExportType> {
      const story = await db.select().from(stories).where(eq(stories.id, storyId)).get();
      if (!story) {
        throw new Error(`Story with ID ${storyId} not found for export.`);
      }

      const belongsToStory = (table: { storyId: any; isDeleted: any }) =>
        and(eq(table.storyId, storyId), eq(table.isDeleted, false));

      const [
        storyChapters,
        storyScenes,
        storyChoices,
        storyCharacters,
        storyLocations,
        storyLocationRelations,
        storyWorldRules,
        storyNotes,
        storyNoteRelations,
        storyTags,
        storyTagRelations,
        storySuggestions,
        storyChapterAnchors,
        storyOwnCalendars,
        storyBoards,
        storyLocationMaps,
        storyCharacterRelations,
        storyCharacterScenes,
        storyGalleryItems,
        storyGalleryRelations,
        storyItems,
        storyItemJourneys,
        storySchemaFieldRows,
        storyAttributeValues,
        storyFavorites,
        storyComments,
        storySeeAlsoRelations,
        storyStats,
        storyStatStrengths,
        storyStatRelations,
        storyModes,
        storyPlots,
        storyPlotScenes,
        storyChoiceCheckGroups,
        storyChoiceChecks,
        storyEffects,
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
        db.query.chapterAnchors.findMany({ where: belongsToStory(chapterAnchors) }),
        db.query.storyCalendars.findMany({ where: belongsToStory(storyCalendars) }),
        db.query.boards.findMany({ where: belongsToStory(boards) }),
        db.query.locationMaps.findMany({ where: belongsToStory(locationMaps) }),
        db.query.characterRelations.findMany({ where: belongsToStory(characterRelations) }),
        db.query.characterScenes.findMany({ where: belongsToStory(characterScenes) }),
        db.query.galleries.findMany({ where: belongsToStory(galleries) }),
        db.query.galleryRelations.findMany({ where: belongsToStory(galleryRelations) }),
        db.query.items.findMany({ where: belongsToStory(items) }),
        db.query.itemJourneys.findMany({ where: belongsToStory(itemJourneys) }),
        db.query.storySchemaFields.findMany({ where: belongsToStory(storySchemaFields) }),
        db.query.attributeValues.findMany({ where: belongsToStory(attributeValues) }),
        db.query.favorites.findMany({ where: belongsToStory(favorites) }),
        db.query.comments.findMany({ where: belongsToStory(comments) }),
        db.query.seeAlsoRelations.findMany({ where: belongsToStory(seeAlsoRelations) }),
        db.query.stats.findMany({ where: belongsToStory(stats) }),
        db.query.statStrengths.findMany({ where: belongsToStory(statStrengths) }),
        db.query.statRelations.findMany({ where: belongsToStory(statRelations) }),
        db.query.modes.findMany({ where: belongsToStory(modes) }),
        db.query.plots.findMany({ where: belongsToStory(plots) }),
        db.query.plotScenes.findMany({ where: belongsToStory(plotScenes) }),
        db.query.choiceCheckGroups.findMany({ where: belongsToStory(choiceCheckGroups) }),
        db.query.choiceChecks.findMany({ where: belongsToStory(choiceChecks) }),
        db.query.effects.findMany({ where: belongsToStory(effects) }),
      ]);

      // Soft-deleted entities are left out above, and until this pruning the relations pointing at
      // them travelled anyway: a package carrying a relation to a character deleted last week, which
      // re-import turned into a link to nothing. The graph screens had to learn to ignore those.
      return FullStoryExportSchema.parse(
        pruneDanglingStoryExportRows({
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
          chapterAnchors: storyChapterAnchors,
          storyCalendars: storyOwnCalendars,
          storyBoards,
          storyLocationMaps,
          characterRelations: storyCharacterRelations,
          characterScenes: storyCharacterScenes,
          galleryItems: storyGalleryItems,
          galleryRelations: storyGalleryRelations,
          items: storyItems,
          itemJourneys: storyItemJourneys,
          storySchemaFields: storySchemaFieldRows,
          attributeValues: storyAttributeValues,
          favorites: storyFavorites,
          comments: storyComments,
          seeAlsoRelations: storySeeAlsoRelations,
          stats: storyStats,
          statStrengths: storyStatStrengths,
          statRelations: storyStatRelations,
          modes: storyModes,
          plots: storyPlots,
          plotScenes: storyPlotScenes,
          // The choices' conditions and effects: they are what makes a branching story work.
          // They were left out of the export for years - the importer here always knew how to read them, and the
          // API always exported them, so a package generated on the device came back without the choices'
          // logic and nobody saw any error, because in the schema these fields are optional.
          choiceCheckGroups: storyChoiceCheckGroups,
          choiceChecks: storyChoiceChecks,
          effects: storyEffects,
          // The importer uses this number as the synchronization's starting point. Preserving the
          // local marker keeps the package useful for a story already linked to a server.
          serverLastOperationVersion: story.lastServerSyncedLog || 0,
          formatVersion: CURRENT_STORY_FORMAT_VERSION,
        }),
      );
    },

    async importFullStory(
      userId: string,
      fullStoryData: FullStoryExportType,
      queriedServerId: string | null,
      role: EffectiveStoryRole | null = null,
      localMediaPaths?: Map<string, string>,
      localImportStoryId?: string,
    ): Promise<string> {
      // A file import is a new local copy. A server download keeps remote IDs because those
      // IDs are the synchronization identity for that shared story.
      const importedStoryData = queriedServerId
        ? fullStoryData
        : cloneStoryForLocalImport(fullStoryData, userId, localImportStoryId);
      fullStoryData = importedStoryData;
      // `FullStoryExportSchema` has already approved every row on its own; what it cannot see is
      // the file as a set - two relations describing the same pair of characters, a sceneId with
      // no scene behind it. The inserts below are blind (`tx.insert` in a loop, no checks), and
      // local SQLite is more permissive than the server's PostgreSQL, so without this the corrupt
      // rows land in the database and only surface much later, as a rejected sync.
      // Run after the clone: it is the remapped ids that are actually inserted.
      assertStoryExportIntegrity(importedStoryData);
      return db.transaction(async (tx) => {
        // Defensive: the caller already confirmed there's no `stories` row for this id (the
        // "already imported" check in ImportExportScreen/ExampleStoryService), but that alone
        // doesn't guarantee a clean slate - orphaned child rows from an interrupted import or
        // a deletion made before deleteStoryChildRows covered every table would collide with
        // the fresh inserts below (e.g. a stale locationRelations row hitting its UNIQUE
        // constraint on id). Clearing first makes a retry self-healing either way.
        await deleteStoryChildRows(tx, importedStoryData.story.id);

        // 1. Process Story
        const originalStory = importedStoryData.story;
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

          // Who loses the mark is decided in `@keres/shared` - the same function the server
          // uses when importing a published story.
          const unflag = scenesToUnflag(importedScenes);
          const versionOf = new Map(importedScenes.map((scene) => [scene.id, scene.version]));
          for (const sceneId of unflag.start) {
            await tx
              .update(scenes)
              .set({ isStart: false, updatedAt: now, version: (versionOf.get(sceneId) ?? 0) + 1 })
              .where(eq(scenes.id, sceneId));
          }
          for (const sceneId of unflag.finish) {
            await tx
              .update(scenes)
              .set({ isFinish: false, updatedAt: now, version: (versionOf.get(sceneId) ?? 0) + 1 })
              .where(eq(scenes.id, sceneId));
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

        // 4.1 Process ChoiceCheckGroups/ChoiceChecks/Effects (Optional) - new to the story,
        // optional arrays for the same reason as locationRelations above: an old export (or
        // an example story packaged before those fields existed) does not have them.
        if (fullStoryData.choiceCheckGroups) {
          for (const group of fullStoryData.choiceCheckGroups) {
            const groupToInsert: ChoiceCheckGroupInsert = {
              ...group,
              storyId: group.storyId,
              choiceId: group.choiceId,
              createdAt: new Date(group.createdAt),
              updatedAt: new Date(),
              version: group.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(choiceCheckGroups).values(groupToInsert).run();
          }
        }
        // ChoiceChecks and Effects are inserted after Items: both may have an itemId.

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

        // 6.1 Process LocationRelations (Optional) - after Locations on purpose, see the
        // equivalent comment in StoryExportImportService.ts (API).
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
            deletedAt: null,
          };
          await tx.insert(suggestions).values(suggestionToInsert).run();
        }

        /*
         * Timeline anchors. Optional in the package: one written before format V7 has none, and
         * `migrateStoryExport` fills in the empty list rather than leaving it undefined - the
         * `?? []` here is for a caller that skipped the migration.
         */
        /*
         * The story's calendars. Nothing to remap - a calendar references no other row, which is
         * the same property that makes it safe to carry between stories at all.
         */
        for (const calendar of fullStoryData.storyCalendars ?? []) {
          await tx
            .insert(storyCalendars)
            .values({
              ...calendar,
              storyId: calendar.storyId,
              createdAt: new Date(calendar.createdAt),
              updatedAt: new Date(),
              version: calendar.version,
              isDeleted: false,
              deletedAt: null,
            })
            .run();
        }

        /*
         * Boards. `content.entityId` has already been remapped by cloneStoryForLocalImport.
         * Ghost pins (an id that was never in the package) stay as they were.
         */
        for (const board of fullStoryData.storyBoards ?? []) {
          await tx
            .insert(boards)
            .values({
              ...board,
              storyId: board.storyId,
              createdAt: new Date(board.createdAt),
              updatedAt: new Date(),
              version: board.version,
              isDeleted: false,
              deletedAt: null,
            })
            .run();
        }

        /*
         * Location maps. `content.locationId`/`content.galleryId` have already been remapped by
         * cloneStoryForLocalImport; ids that were never in the package stay as they were.
         */
        for (const map of fullStoryData.storyLocationMaps ?? []) {
          await tx
            .insert(locationMaps)
            .values({
              ...map,
              storyId: map.storyId,
              createdAt: new Date(map.createdAt),
              updatedAt: new Date(),
              version: map.version,
              isDeleted: false,
              deletedAt: null,
            })
            .run();
        }

        for (const anchor of fullStoryData.chapterAnchors ?? []) {
          await tx
            .insert(chapterAnchors)
            .values({
              ...anchor,
              storyId: anchor.storyId,
              createdAt: new Date(anchor.createdAt),
              updatedAt: new Date(),
              version: anchor.version,
              isDeleted: false,
              deletedAt: null,
            })
            .run();
        }

        // 11. Process CharacterRelations
        for (const charRelation of fullStoryData.characterRelations) {
          const charRelationToInsert: CharacterRelationInsert = {
            ...charRelation,
            storyId: charRelation.storyId,
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

        // 12b. Process Plots
        for (const plot of fullStoryData.plots ?? []) {
          const plotToInsert: PlotInsert = {
            ...plot,
            createdAt: new Date(plot.createdAt),
            updatedAt: new Date(),
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(plots).values(plotToInsert).run();
        }

        // 12c. Process PlotScenes
        for (const plotScene of fullStoryData.plotScenes ?? []) {
          const plotSceneToInsert: PlotSceneInsert = {
            ...plotScene,
            createdAt: new Date(plotScene.createdAt),
            updatedAt: new Date(),
            isDeleted: false,
            deletedAt: null,
          };
          await tx.insert(plotScenes).values(plotSceneToInsert).run();
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
            // A `.zip` package has already brought this medium's bytes to the device before this
            // transaction began (see `ImportExportScreen.handleImport`); a plain `.json`
            // carries only the metadata, and the bytes stay on the server, addressed by the hash.
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
              // With the file already here, what is missing is the upload to the server (if/when the story
              // is linked to one); without it, what is missing is the download - synchronization decides on its own
              // from these two states.
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

        // 15b. Process ChoiceChecks/Effects after Items, because inventory checks and item
        // grant/take effects have real foreign keys to the item table.
        if (fullStoryData.choiceChecks) {
          for (const check of fullStoryData.choiceChecks) {
            const checkToInsert: ChoiceCheckInsert = {
              ...check,
              storyId: check.storyId,
              groupId: check.groupId,
              createdAt: new Date(check.createdAt),
              updatedAt: new Date(),
              version: check.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(choiceChecks).values(checkToInsert).run();
          }
        }
        if (fullStoryData.effects) {
          for (const effect of fullStoryData.effects) {
            const effectToInsert: EffectInsert = {
              ...effect,
              storyId: effect.storyId,
              entityType: effect.entityType,
              entityId: effect.entityId,
              createdAt: new Date(effect.createdAt),
              updatedAt: new Date(),
              version: effect.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(effects).values(effectToInsert).run();
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

        // 19. Process AttributeValues (Optional) - last on purpose: entityId may
        // point at any of the 7 supported entity types, all already inserted above,
        // and fieldId depends on the StorySchemaFields block just above. In local imports,
        // the IDs have already arrived remapped by cloneStoryForLocalImport.
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

        // "See also" relations only enter after the entities they point at. The relation
        // already arrives canonicalized by the service that created it; the local copy has already remapped both sides.
        if (fullStoryData.seeAlsoRelations) {
          for (const relation of fullStoryData.seeAlsoRelations) {
            const relationToInsert: SeeAlsoRelationInsert = {
              ...relation,
              storyId: originalStory.id,
              createdAt: new Date(relation.createdAt),
              updatedAt: new Date(),
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(seeAlsoRelations).values(relationToInsert).onConflictDoNothing().run();
          }
        }

        // In a local copy, the comment's author becomes the local user, exactly like
        // Favorites. When importing a story already linked to a server, we preserve the original
        // author so as not to reassign collaborative annotations.
        if (fullStoryData.comments) {
          for (const comment of fullStoryData.comments) {
            const commentToInsert: CommentInsert = {
              ...comment,
              storyId: originalStory.id,
              authorUserId: queriedServerId ? comment.authorUserId : userId,
              createdAt: new Date(comment.createdAt),
              updatedAt: new Date(),
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(comments).values(commentToInsert).run();
          }
        }

        // The stats system: Stat and Mode before StatStrength/StatRelation, which reference them.
        if (fullStoryData.stats) {
          for (const stat of fullStoryData.stats) {
            const statToInsert: StatInsert = {
              ...stat,
              storyId: originalStory.id,
              createdAt: new Date(stat.createdAt),
              updatedAt: new Date(),
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(stats).values(statToInsert).run();
          }
        }

        if (fullStoryData.modes) {
          for (const mode of fullStoryData.modes) {
            const modeToInsert: ModeInsert = {
              ...mode,
              storyId: originalStory.id,
              createdAt: new Date(mode.createdAt),
              updatedAt: new Date(),
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(modes).values(modeToInsert).run();
          }
        }

        if (fullStoryData.statStrengths) {
          for (const strength of fullStoryData.statStrengths) {
            const strengthToInsert: StatStrengthInsert = {
              ...strength,
              storyId: originalStory.id,
              createdAt: new Date(strength.createdAt),
              updatedAt: new Date(),
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(statStrengths).values(strengthToInsert).run();
          }
        }

        if (fullStoryData.statRelations) {
          for (const value of fullStoryData.statRelations) {
            const valueToInsert: StatRelationInsert = {
              ...value,
              storyId: originalStory.id,
              createdAt: new Date(value.createdAt),
              updatedAt: new Date(),
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(statRelations).values(valueToInsert).run();
          }
        }

        if (fullStoryData.favorites) {
          for (const favorite of fullStoryData.favorites) {
            await tx
              .insert(favorites)
              .values({
                ...favorite,
                storyId: originalStory.id,
                userId: queriedServerId ? favorite.userId : userId,
                createdAt: new Date(favorite.createdAt),
                updatedAt: new Date(),
                isDeleted: false,
                deletedAt: null,
              })
              .onConflictDoNothing()
              .run();
          }
        }

        return originalStory.id;
      });
    },
  };
};
