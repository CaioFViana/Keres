import { FullStoryExportType } from '@keres/shared';
import { and, count, eq, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import {
  ChapterInsert, ChapterSelect,
  CharacterInsert, CharacterSelect,
  ChoiceInsert, ChoiceSelect,
  LocationInsert, LocationSelect,
  NoteInsert, NoteSelect,
  SceneInsert, SceneSelect,
  StoryInsert, StorySelect,
  WorldRuleInsert, WorldRuleSelect,
  chapters,
  characterRelations, // Added
  characterScenes,
  characters,
  choices, // Added
  galleries,
  itemJourneys,
  items,
  locations,
  notes,
  scenes,
  stories, // Added
  suggestions, // Added
  tagRelations, // Added
  tags,
  worldRules
} from '../db/schema';
import { Create, prepareNewEntityData } from '../utils/entityUtils';

export interface StoryService {
  getAllStories(): Promise<StorySelect[]>;
  getStoryById(storyId: string): Promise<StorySelect | undefined>;
  createStory(storyData: Create<StoryInsert>): Promise<StorySelect>;
  updateStory(storyId: string, storyData: Partial<Omit<StoryInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt' | 'serverId'>>): Promise<void>;
  getStoryCounts(): Promise<{ totalStories: number; branchingStories: number }>;
  getCharacterCount(storyId?: string): Promise<number>;
  getChoiceCount(storyId?: string): Promise<number>;
  getLocationCount(storyId?: string): Promise<number>;
  getChapterCount(storyId?: string): Promise<number>;
  getSceneCount(storyId?: string): Promise<number>;
  getNoteCount(storyId?: string): Promise<number>;
  getWorldRuleCount(storyId?: string): Promise<number>;

  // New creation methods using Create<T>
  createCharacter(characterData: Create<CharacterInsert>): Promise<CharacterSelect>;
  createChapter(chapterData: Create<ChapterInsert>): Promise<ChapterSelect>;
  createLocation(locationData: Create<LocationInsert>): Promise<LocationSelect>;
  createScene(sceneData: Create<SceneInsert>): Promise<SceneSelect>;
  createNote(noteData: Create<NoteInsert>): Promise<NoteSelect>;
  createWorldRule(worldRuleData: Create<WorldRuleInsert>): Promise<WorldRuleSelect>;
  createChoice(choiceData: Create<ChoiceInsert>): Promise<ChoiceSelect>;

  updateStoryFavoriteStatus(storyId: string, isFavorite: boolean): Promise<void>;
  deleteStory(storyId: string): Promise<void>;
  getBranchingStoryForkCount(): Promise<number>;
  importFullStory(userId: string, fullStoryData: FullStoryExportType): Promise<string>; // Added importFullStory to interface
}

export const createStoryService = (db: AppDrizzleClient): StoryService => {
  return {
    async getAllStories(): Promise<StorySelect[]> {
      return db.select().from(stories).all();
    },

    async getStoryById(storyId: string): Promise<StorySelect | undefined> {
      return db.select().from(stories).where(eq(stories.id, storyId)).get();
    },

    async createStory(storyData): Promise<StorySelect> {
      const newStory = prepareNewEntityData<StoryInsert>(storyData);
      const result = await db.insert(stories).values(newStory).returning().get();
      return result;
    },

    async updateStory(storyId: string, storyData): Promise<void> {
      await db.update(stories)
        .set({ ...storyData, updatedAt: new Date() })
        .where(eq(stories.id, storyId))
        .run();
    },

    async getStoryCounts(): Promise<{ totalStories: number; branchingStories: number }> {
      const totalStoriesResult = await db.select({ count: count() }).from(stories).get();
      const branchingStoriesResult = await db.select({ count: count() }).from(stories).where(eq(stories.type, 'branching')).get();
      return {
        totalStories: totalStoriesResult?.count || 0,
        branchingStories: branchingStoriesResult?.count || 0,
      };
    },

    async getCharacterCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(characters)
        .innerJoin(stories, eq(characters.storyId, stories.id)) // Join with stories to filter by isDeleted
        .where(storyId ? and(eq(characters.storyId, storyId), eq(stories.isDeleted, false)) : eq(stories.isDeleted, false))
        .get();
      return result?.count || 0;
    },

    async getChoiceCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(choices)
        .innerJoin(scenes, eq(choices.sceneId, scenes.id))
        .innerJoin(stories, eq(scenes.storyId, stories.id))
        .where(storyId ? and(eq(stories.id, storyId), eq(stories.isDeleted, false)) : eq(stories.isDeleted, false))
        .get();
      return result?.count || 0;
    },

    async getLocationCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(locations)
        .innerJoin(stories, eq(locations.storyId, stories.id))
        .where(storyId ? and(eq(stories.id, storyId), eq(stories.isDeleted, false)) : eq(stories.isDeleted, false))
        .get();
      return result?.count || 0;
    },

    async getChapterCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(chapters)
        .innerJoin(stories, eq(chapters.storyId, stories.id))
        .where(storyId ? and(eq(stories.id, storyId), eq(stories.isDeleted, false)) : eq(stories.isDeleted, false))
        .get();
      return result?.count || 0;
    },

    async getSceneCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(scenes)
        .innerJoin(stories, eq(scenes.storyId, stories.id))
        .where(storyId ? and(eq(stories.id, storyId), eq(stories.isDeleted, false)) : eq(stories.isDeleted, false))
        .get();
      return result?.count || 0;
    },

    async getNoteCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(notes)
        .innerJoin(stories, eq(notes.storyId, stories.id))
        .where(storyId ? and(eq(stories.id, storyId), eq(stories.isDeleted, false)) : eq(stories.isDeleted, false))
        .get();
      return result?.count || 0;
    },

    async getWorldRuleCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(worldRules)
        .innerJoin(stories, eq(worldRules.storyId, stories.id))
        .where(storyId ? and(eq(stories.id, storyId), eq(stories.isDeleted, false)) : eq(stories.isDeleted, false))
        .get();
      return result?.count || 0;
    },

    async createCharacter(characterData): Promise<CharacterSelect> {
      const newCharacter = prepareNewEntityData<CharacterInsert>(characterData);
      const result = await db.insert(characters).values(newCharacter).returning().get();
      return result;
    },

    async createChapter(chapterData): Promise<ChapterSelect> {
      const newChapter = prepareNewEntityData<ChapterInsert>(chapterData);
      const result = await db.insert(chapters).values(newChapter).returning().get();
      return result;
    },

    async createLocation(locationData): Promise<LocationSelect> {
      const newLocation = prepareNewEntityData<LocationInsert>(locationData);
      const result = await db.insert(locations).values(newLocation).returning().get();
      return result;
    },

    async createScene(sceneData): Promise<SceneSelect> {
      const newScene = prepareNewEntityData<SceneInsert>(sceneData);
      const result = await db.insert(scenes).values(newScene).returning().get();
      return result;
    },

    async createNote(noteData): Promise<NoteSelect> {
      const newNote = prepareNewEntityData<NoteInsert>(noteData);
      const result = await db.insert(notes).values(newNote).returning().get();
      return result;
    },

    async createWorldRule(worldRuleData): Promise<WorldRuleSelect> {
      const newWorldRule = prepareNewEntityData<WorldRuleInsert>(worldRuleData);
      const result = await db.insert(worldRules).values(newWorldRule).returning().get();
      return result;
    },

    async createChoice(choiceData): Promise<ChoiceSelect> {
      const newChoice = prepareNewEntityData<ChoiceInsert>(choiceData);
      const result = await db.insert(choices).values(newChoice).returning().get();
      return result;
    },

    async updateStoryFavoriteStatus(storyId: string, isFavorite: boolean): Promise<void> {
      await db.update(stories)
        .set({ isFavorite, updatedAt: new Date() })
        .where(eq(stories.id, storyId))
        .run();
    },

    async deleteStory(storyId: string): Promise<void> {
      // While story components delete only via marking for deletion, deleting a story should delete it all!
      // Rest of delete (its components) will come in due time. for now this is enough.
      await db.delete(stories)
        .where(eq(stories.id, storyId))
        .run();
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

    async importFullStory(userId: string, fullStoryData: FullStoryExportType): Promise<string> {
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
          lastServerSyncedLog: fullStoryData.serverLastOperationVersion
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
          const tagToInsert: any = { // Use 'any' temporarily if TagInsert is not fully defined
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
          const suggestionToInsert: any = { // Use 'any' temporarily if SuggestionInsert is not fully defined
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

        // 11. Process CharacterRelations
        for (const charRelation of fullStoryData.characterRelations) {
          const charRelationToInsert: any = { // Use 'any' temporarily if CharacterRelationInsert is not fully defined
            ...charRelation,
            storyId: charRelation.storyId,
            character1Id: charRelation.character1Id,
            character2Id: charRelation.character2Id,
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
          const charSceneToInsert: any = { // Use 'any' temporarily if CharacterSceneInsert is not fully defined
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
            const tagRelationToInsert: any = { // Use 'any' temporarily if TagRelationInsert is not fully defined
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
            const galleryItemToInsert: any = { // Use 'any' temporarily if GalleryInsert is not fully defined
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
            const itemToInsert: any = { // Use 'any' temporarily if ItemInsert is not fully defined
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
            const itemJourneyToInsert: any = { // Use 'any' temporarily if ItemJourneyInsert is not fully defined
              ...itemJourney,
              storyId: itemJourney.storyId,
              itemId: itemJourney.itemId,
              sceneId: itemJourney.sceneId,
              newCharacterOwnerid: itemJourney.newCharacterOwnerid,
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