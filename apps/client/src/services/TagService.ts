import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { tags, TagSelect } from '../db/schema';

export interface TagService {
  getTagsByStoryId(storyId: string): Promise<TagSelect[]>;
  // TODO: Add methods for creating, updating, deleting tags
}

export const createTagService = (db: AppDrizzleClient): TagService => {
  return {
    async getTagsByStoryId(storyId): Promise<TagSelect[]> {
      return db.select().from(tags).where(eq(tags.storyId, storyId)).all();
    },
  };
};
