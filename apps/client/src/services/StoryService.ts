import { count, eq } from 'drizzle-orm';
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
  characters,
  choices,
  locations,
  notes,
  scenes,
  stories,
  worldRules
} from '../db/schema';
import { Create, prepareNewEntityData } from '../utils/entityUtils'; // Import Create type

export interface StoryService {
  getAllStories(): Promise<StorySelect[]>;
  getStoryById(storyId: string): Promise<StorySelect | undefined>; // Added
  createStory(storyData: Create<StoryInsert>): Promise<StorySelect>;
  updateStory(storyId: string, storyData: Partial<Omit<StoryInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt' | 'serverId'>>): Promise<void>; // Added
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
        .where(storyId ? eq(characters.storyId, storyId) : undefined)
        .get();
      return result?.count || 0;
    },

    async getChoiceCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(choices)
        .where(storyId ? eq(choices.storyId, storyId) : undefined)
        .get();
      return result?.count || 0;
    },

    async getLocationCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(locations)
        .where(storyId ? eq(locations.storyId, storyId) : undefined)
        .get();
      return result?.count || 0;
    },

    async getChapterCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(chapters)
        .where(storyId ? eq(chapters.storyId, storyId) : undefined)
        .get();
      return result?.count || 0;
    },

    async getSceneCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(scenes)
        .where(storyId ? eq(scenes.storyId, storyId) : undefined)
        .get();
      return result?.count || 0;
    },

    async getNoteCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(notes)
        .where(storyId ? eq(notes.storyId, storyId) : undefined)
        .get();
      return result?.count || 0;
    },

    async getWorldRuleCount(storyId?: string): Promise<number> {
      const result = await db.select({ count: count() }).from(worldRules)
        .where(storyId ? eq(worldRules.storyId, storyId) : undefined)
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
  };
};
