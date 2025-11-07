import { AppDrizzleClient } from '../db'; // Corrected import
import { stories, StoryInsert, StorySelect, characters, choices, locations, chapters, scenes, notes, worldRules } from '../db/schema';
import { eq, count } from 'drizzle-orm';
import { createULID } from '../utils/ulid'; // Import createULID

export interface StoryService {
  getAllStories(): Promise<StorySelect[]>;
  createStory(storyData: Omit<StoryInsert, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>): Promise<StorySelect>;
  getStoryCounts(): Promise<{ totalStories: number; branchingStories: number }>;
  getCharacterCount(storyId?: string): Promise<number>;
  getChoiceCount(storyId?: string): Promise<number>;
  getLocationCount(storyId?: string): Promise<number>;
  getChapterCount(storyId?: string): Promise<number>;
  getSceneCount(storyId?: string): Promise<number>;
  getNoteCount(storyId?: string): Promise<number>;
  getWorldRuleCount(storyId?: string): Promise<number>;
}

export const createStoryService = (db: AppDrizzleClient): StoryService => {
  return {
    async getAllStories(): Promise<StorySelect[]> {
      return db.select().from(stories).all();
    },

    async createStory(storyData): Promise<StorySelect> {
      const newStory: StoryInsert = {
        id: createULID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        isDeleted: false,
        deletedAt: null,
        ...storyData,
      };

      const result = await db.insert(stories).values(newStory).returning().get();
      return result;
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
      let query = db.select({ count: count() }).from(characters);
      if (storyId) {
        query = query.where(eq(characters.storyId, storyId));
      }
      const result = await query.get();
      return result?.count || 0;
    },

    async getChoiceCount(storyId?: string): Promise<number> {
      let query = db.select({ count: count() }).from(choices);
      if (storyId) {
        query = query.where(eq(choices.storyId, storyId));
      }
      const result = await query.get();
      return result?.count || 0;
    },

    async getLocationCount(storyId?: string): Promise<number> {
      let query = db.select({ count: count() }).from(locations);
      if (storyId) {
        query = query.where(eq(locations.storyId, storyId));
      }
      const result = await query.get();
      return result?.count || 0;
    },

    async getChapterCount(storyId?: string): Promise<number> {
      let query = db.select({ count: count() }).from(chapters);
      if (storyId) {
        query = query.where(eq(chapters.storyId, storyId));
      }
      const result = await query.get();
      return result?.count || 0;
    },

    async getSceneCount(storyId?: string): Promise<number> {
      let query = db.select({ count: count() }).from(scenes);
      if (storyId) {
        query = query.where(eq(scenes.storyId, storyId));
      }
      const result = await query.get();
      return result?.count || 0;
    },

    async getNoteCount(storyId?: string): Promise<number> {
      let query = db.select({ count: count() }).from(notes);
      if (storyId) {
        query = query.where(eq(notes.storyId, storyId));
      }
      const result = await query.get();
      return result?.count || 0;
    },

    async getWorldRuleCount(storyId?: string): Promise<number> {
      let query = db.select({ count: count() }).from(worldRules);
      if (storyId) {
        query = query.where(eq(worldRules.storyId, storyId));
      }
      const result = await query.get();
      return result?.count || 0;
    },
  };
};
