import { eq, and, sql, SQL } from 'drizzle-orm'; // Changed to and, removed or
import { AppDrizzleClient } from '../db';
import { tags, TagSelect } from '../db/schema';

export interface TagService {
  getTagsByStoryId(storyId: string, searchTerm?: string): Promise<TagSelect[]>; // Added searchTerm
  // TODO: Add methods for creating, updating, deleting tags
}

export const createTagService = (db: AppDrizzleClient): TagService => {
  return {
    async getTagsByStoryId(storyId, searchTerm): Promise<TagSelect[]> { // Added searchTerm
      console.log('TagService: getTagsByStoryId called with storyId:', storyId, 'searchTerm:', searchTerm); // Added log
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(tags.storyId, storyId) as SQL<boolean> // Explicit cast to SQL<boolean>
      ];

      if (searchTerm) {
        conditions.push(sql`${tags.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>);
      }

      // Filter out undefined conditions and use 'and' to combine them
      const finalConditions = conditions.filter(Boolean) as SQL<boolean>[];

      const result = await db.select().from(tags).where(and(...finalConditions)).all();
      console.log('TagService: Query result:', result); // Added log
      return result;
    },
  };
};
