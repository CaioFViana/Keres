import { FullStoryExportType } from '@keres/shared';
import { and, count, eq, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import {
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
  ItemInsert,
  ItemJourneyInsert,
  itemJourneys,
  items,
  LocationInsert,
  locations,
  LocationSelect,
  NoteInsert,
  notes,
  NoteSelect,
  SceneInsert,
  scenes,
  SceneSelect,
  stories,
  StoryInsert, StorySelect,
  SuggestionInsert,
  suggestions,
  TagInsert,
  TagRelationInsert,
  tagRelations,
  tags,
  WorldRuleInsert,
  worldRules,
  WorldRuleSelect
} from '../db/schema';
import { Create, prepareNewEntityData } from '../utils/entityUtils';

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

  // New creation methods using Create<T>
  createCharacter(currentUserId: string, characterData: Create<CharacterInsert>): Promise<CharacterSelect>;
  createChapter(currentUserId: string, chapterData: Create<ChapterInsert>): Promise<ChapterSelect>;
  createLocation(currentUserId: string, locationData: Create<LocationInsert>): Promise<LocationSelect>;
  createScene(currentUserId: string, sceneData: Create<SceneInsert>): Promise<SceneSelect>;
  createNote(currentUserId: string, noteData: Create<NoteInsert>): Promise<NoteSelect>;
  createWorldRule(currentUserId: string, worldRuleData: Create<WorldRuleInsert>): Promise<WorldRuleSelect>;
  createChoice(currentUserId: string, choiceData: Create<ChoiceInsert>): Promise<ChoiceSelect>;

  updateStoryFavoriteStatus(currentUserId: string, storyId: string, isFavorite: boolean): Promise<void>;
  deleteStory(currentUserId: string, storyId: string): Promise<void>;
  getBranchingStoryForkCount(): Promise<number>;
  importFullStory(userId: string, fullStoryData: FullStoryExportType, queriedServerId: string | null): Promise<string>;
}


import { createOperationLogService } from './OperationLogService';

export const createStoryService = (db: AppDrizzleClient): StoryService => {
  const operationLogService = createOperationLogService();
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

      const userIdToLog = await operationLogService.getUserIdForOperation(db, newStory.id, currentUserId);
      await operationLogService.recordLocalOperation(db, newStory.id, userIdToLog, 'create', 'Story', newStory.id, { ...newStory }); // Pass serializable data

      return result;
    },

    async updateStory(currentUserId: string, storyId: string, storyData: Partial<Omit<StoryInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void> {
      const updatedFields = { ...storyData, updatedAt: new Date() };
      // Perform the update and return the new version
      const [updatedStory] = await db.update(stories)
        .set({ ...updatedFields, version: sql`${stories.version} + 1` })
        .where(eq(stories.id, storyId))
        .returning({ version: stories.version });
      
      if (!updatedStory) {
        throw new Error(`Failed to update story ${storyId} or story not found.`);
      }

      const userIdToLog = await operationLogService.getUserIdForOperation(db, storyId, currentUserId);
      // Construct a clean payload for logging, ensuring dates are strings and no Drizzle SQL objects
      const payloadForLog = {
        ...storyData,
        version: updatedStory.version, // Use the new version from DB
      };
      await operationLogService.recordLocalOperation(db, storyId, userIdToLog, 'update', 'Story', storyId, payloadForLog);
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

    async createCharacter(currentUserId: string, characterData: Create<CharacterInsert>): Promise<CharacterSelect> {
      const newCharacter = prepareNewEntityData<CharacterInsert>(characterData);
      const result = await db.insert(characters).values(newCharacter).returning().get();

      const userIdToLog = await operationLogService.getUserIdForOperation(db, newCharacter.storyId, currentUserId);
      await operationLogService.recordLocalOperation(db, newCharacter.storyId, userIdToLog, 'create', 'Character', newCharacter.id, { ...newCharacter }); // Pass serializable data

      return result;
    },

    async createChapter(currentUserId: string, chapterData: Create<ChapterInsert>): Promise<ChapterSelect> {
      const newChapter = prepareNewEntityData<ChapterInsert>(chapterData);
      const result = await db.insert(chapters).values(newChapter).returning().get();

      const userIdToLog = await operationLogService.getUserIdForOperation(db, newChapter.storyId, currentUserId);
      await operationLogService.recordLocalOperation(db, newChapter.storyId, userIdToLog, 'create', 'Chapter', newChapter.id, { ...newChapter }); // Pass serializable data

      return result;
    },

    async createLocation(currentUserId: string, locationData: Create<LocationInsert>): Promise<LocationSelect> {
      const newLocation = prepareNewEntityData<LocationInsert>(locationData);
      const result = await db.insert(locations).values(newLocation).returning().get();

      const userIdToLog = await operationLogService.getUserIdForOperation(db, newLocation.storyId, currentUserId);
      await operationLogService.recordLocalOperation(db, newLocation.storyId, userIdToLog, 'create', 'Location', newLocation.id, { ...newLocation }); // Pass serializable data

      return result;
    },

    async createScene(currentUserId: string, sceneData: Create<SceneInsert>): Promise<SceneSelect> {
      const newScene = prepareNewEntityData<SceneInsert>(sceneData);
      const result = await db.insert(scenes).values(newScene).returning().get();

      const userIdToLog = await operationLogService.getUserIdForOperation(db, newScene.storyId, currentUserId);
      await operationLogService.recordLocalOperation(db, newScene.storyId, userIdToLog, 'create', 'Scene', newScene.id, { ...newScene }); // Pass serializable data

      return result;
    },

    async createNote(currentUserId: string, noteData: Create<NoteInsert>): Promise<NoteSelect> {
      const newNote = prepareNewEntityData<NoteInsert>(noteData);
      const result = await db.insert(notes).values(newNote).returning().get();

      const userIdToLog = await operationLogService.getUserIdForOperation(db, newNote.storyId, currentUserId);
      await operationLogService.recordLocalOperation(db, newNote.storyId, userIdToLog, 'create', 'Note', newNote.id, { ...newNote }); // Pass serializable data

      return result;
    },

    async createWorldRule(currentUserId: string, worldRuleData: Create<WorldRuleInsert>): Promise<WorldRuleSelect> {
      const newWorldRule = prepareNewEntityData<WorldRuleInsert>(worldRuleData);
      const result = await db.insert(worldRules).values(newWorldRule).returning().get();

      const userIdToLog = await operationLogService.getUserIdForOperation(db, newWorldRule.storyId, currentUserId);
      await operationLogService.recordLocalOperation(db, newWorldRule.storyId, userIdToLog, 'create', 'WorldRule', newWorldRule.id, { ...newWorldRule }); // Pass serializable data

      return result;
    },

    async createChoice(currentUserId: string, choiceData: Create<ChoiceInsert>): Promise<ChoiceSelect> {
      const newChoice = prepareNewEntityData<ChoiceInsert>(choiceData);
      const result = await db.insert(choices).values(newChoice).returning().get();

      const userIdToLog = await operationLogService.getUserIdForOperation(db, newChoice.storyId, currentUserId);
      await operationLogService.recordLocalOperation(db, newChoice.storyId, userIdToLog, 'create', 'Choice', newChoice.id, { ...newChoice }); // Pass serializable data

      return result;
    },

    async updateStoryFavoriteStatus(currentUserId: string, storyId: string, isFavorite: boolean): Promise<void> {
      const [updatedStory] = await db.update(stories)
        .set({ isFavorite, updatedAt: new Date(), version: sql`${stories.version} + 1` })
        .where(eq(stories.id, storyId))
        .returning({ isFavorite: stories.isFavorite, version: stories.version });

      if (!updatedStory) {
        throw new Error(`Failed to update favorite status for story ${storyId} or story not found.`);
      }
      
      const userIdToLog = await operationLogService.getUserIdForOperation(db, storyId, currentUserId);
      await operationLogService.recordLocalOperation(db, storyId, userIdToLog, 'update', 'Story', storyId, {
        isFavorite: updatedStory.isFavorite,
        version: updatedStory.version,
      });
    },

    async deleteStory(currentUserId: string, storyId: string): Promise<void> {
      const storyToDelete = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
      });

      if (!storyToDelete) {
        console.warn(`Attempted to delete non-existent story ${storyId}.`);
        return;
      }

      // Perform the update and return the new version
      const [updatedStory] = await db.update(stories)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${stories.version} + 1` })
        .where(eq(stories.id, storyId))
        .returning({ version: stories.version }); // Return relevant fields
      
      if (!updatedStory) {
        throw new Error(`Failed to delete story ${storyId} or story not found.`);
      }

      const userIdToLog = await operationLogService.getUserIdForOperation(db, storyId, currentUserId);
      await operationLogService.recordLocalOperation(db, storyId, userIdToLog, 'delete', 'Story', storyId, {
        id: storyId,
        isDeleted: true,
        version: updatedStory.version,
      });
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

    async importFullStory(userId: string, fullStoryData: FullStoryExportType, queriedServerId: string | null): Promise<string> {
      return db.transaction(async (tx) => {
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
            const galleryItemToInsert: GalleryInsert = {
              ...galleryItem,
              storyId: galleryItem.storyId,
              ownerId: galleryItem.ownerId,
              createdAt: new Date(galleryItem.createdAt),
              updatedAt: new Date(),
              version: galleryItem.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(galleries).values(galleryItemToInsert).run();
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
              newCharacterOwnerId: itemJourney.newCharacterOwnerid,
              createdAt: new Date(itemJourney.createdAt),
              updatedAt: new Date(),
              version: itemJourney.version,
              isDeleted: false,
              deletedAt: null,
            };
            await tx.insert(itemJourneys).values(itemJourneyToInsert).run();
          }
        }

        return originalStory.id; // Return the original story ID
      });
    },
  };
};