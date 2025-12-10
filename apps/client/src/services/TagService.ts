import { and, eq, sql, SQL } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { TagInsert, tags, TagSelect } from '../db/schema'; // Import TagInsert and stories
import { Create, prepareNewEntityData } from '../utils/entityUtils'; // Import Create and prepareNewEntityData
import { getUserIdForOperation, recordLocalOperation } from '../utils/syncUtils'; // Import recordLocalOperation and getUserIdForOperation
import { createServerService } from './ServerService'; // Import ServerService and createServerService

export interface TagService {
  getTagsByStoryId(storyId: string, searchTerm?: string): Promise<TagSelect[]>;
  createTag(currentUserId: string, tagData: Create<TagInsert>): Promise<TagSelect>;
  updateTag(currentUserId: string, tagId: string, tagData: Partial<Omit<TagInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void>;
  deleteTag(currentUserId: string, tagId: string): Promise<void>;
}

export const createTagService = (db: AppDrizzleClient): TagService => {
  const serverService = createServerService(db); // Create serverService once
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
      return result;
    },

    async createTag(currentUserId: string, tagData: Create<TagInsert>): Promise<TagSelect> {
      const newTag = prepareNewEntityData<TagInsert>(tagData);
      const result = await db.insert(tags).values(newTag).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newTag.storyId, currentUserId);
      await recordLocalOperation(db, newTag.storyId, userIdToLog, 'create', 'Tag', newTag.id, { ...result });

      return result;
    },

    async updateTag(currentUserId: string, tagId: string, tagData: Partial<Omit<TagInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void> {
      const [updatedTag] = await db.update(tags)
        .set({ ...tagData, updatedAt: new Date(), version: sql`${tags.version} + 1` })
        .where(eq(tags.id, tagId))
        .returning({ id: tags.id, storyId: tags.storyId, version: tags.version }); // Return relevant fields

      if (!updatedTag) {
        throw new Error(`Failed to update tag ${tagId} or tag not found.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedTag.storyId, currentUserId);
      await recordLocalOperation(db, updatedTag.storyId, userIdToLog, 'update', 'Tag', tagId, {
        ...tagData,
        version: updatedTag.version,
      });
    },

    async deleteTag(currentUserId: string, tagId: string): Promise<void> {
      const tagToDelete = await db.query.tags.findFirst({ where: eq(tags.id, tagId) });
      if (!tagToDelete) {
        console.warn(`Attempted to delete non-existent tag ${tagId}.`);
        return;
      }

      const [updatedTag] = await db.update(tags)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${tags.version} + 1` })
        .where(eq(tags.id, tagId))
        .returning({ id: tags.id, storyId: tags.storyId, isDeleted: tags.isDeleted, version: tags.version });

      if (!updatedTag) {
        throw new Error(`Failed to delete tag ${tagId} or tag not found.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedTag.storyId, currentUserId);
      await recordLocalOperation(db, updatedTag.storyId, userIdToLog, 'delete', 'Tag', tagId, {
        id: updatedTag.id,
        isDeleted: updatedTag.isDeleted,
        version: updatedTag.version,
      });
    },
  };
};