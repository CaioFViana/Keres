import { AppDrizzleClient } from '../db'; // Corrected import
import { stories, StoryInsert, StorySelect } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createULID } from '../utils/ulid'; // Import createULID

export interface StoryService {
  getAllStories(): Promise<StorySelect[]>;
  createStory(storyData: Omit<StoryInsert, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>): Promise<StorySelect>;
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
  };
};
