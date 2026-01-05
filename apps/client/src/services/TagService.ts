import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { and, asc, desc, eq, inArray, sql, SQL } from 'drizzle-orm'; // Import asc and desc
import { AppDrizzleClient } from '../db';
import { TagInsert, tags, TagSelect } from '../db/schema'; // Import TagInsert and stories
import { getChangedFields } from '../utils/diffUtils';
import { Create, prepareNewEntityData } from '../utils/entityUtils'; // Import Create and prepareNewEntityData
import { entityEventEmitter } from '../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../utils/syncUtils'; // Import recordLocalOperation and getUserIdForOperation
import { createServerService } from './ServerService'; // Import ServerService and createServerService

export type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

export interface TagService {
  getTagsByStoryId(
    storyId: string,
    searchTerm?: string,
    activeFilterTags?: string[],
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: { [key: string]: any },
  ): Promise<TagSelect[]>;
  getById(tagId: string): Promise<TagSelect | undefined>;
  createTag(currentUserId: string, tagData: Create<TagInsert>): Promise<TagSelect>;
  updateTag(currentUserId: string, tagId: string, tagData: Partial<Omit<TagInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void>;
  deleteTag(currentUserId: string, tagId: string): Promise<void>;
}

export const createTagService = (db: AppDrizzleClient): TagService => {
  const serverService = createServerService(db); // Create serverService once
  return {
    async getTagsByStoryId(storyId, searchTerm, activeFilterTags, sortBy, sortDirection, favoriteFilterState, advancedSearchCriteria): Promise<TagSelect[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(tags.storyId, storyId) as SQL<boolean>, // Explicit cast to SQL<boolean>
        eq(tags.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        conditions.push(sql`${tags.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>);
      }

      if (activeFilterTags && activeFilterTags.length > 0) {
        conditions.push(inArray(tags.id, activeFilterTags) as SQL<boolean>);
      }

      if (favoriteFilterState === 'favorite') {
        conditions.push(eq(tags.isFavorite, true) as SQL<boolean>); // Explicit cast
      } else if (favoriteFilterState === 'not-favorite') {
        conditions.push(eq(tags.isFavorite, false) as SQL<boolean>); // Explicit cast
      }

      // Apply advanced search criteria
      if (advancedSearchCriteria && Object.keys(advancedSearchCriteria).length > 0) {
        const tagMetadata = entityFieldMetadata['Tag'];
        for (const key in advancedSearchCriteria) {
          if (Object.prototype.hasOwnProperty.call(advancedSearchCriteria, key)) {
            const value = advancedSearchCriteria[key];
            const fieldMeta = tagMetadata.find(meta => meta.name === key);

            if (value !== undefined && value !== '' && fieldMeta) {
              if (fieldMeta.type === 'string') {
                conditions.push(sql`${tags[key as keyof TagSelect]} LIKE ${`%${value}%`} COLLATE NOCASE` as SQL<boolean>);
              } else if (fieldMeta.type === 'boolean') {
                conditions.push(eq(tags[key as keyof TagSelect], value) as SQL<boolean>);
              } else if (fieldMeta.type === 'color') {
                conditions.push(eq(tags[key as keyof TagSelect], value) as SQL<boolean>);
              }
              // Add other types (number, date, etc.) as needed
            }
          }
        }
      }

      // Filter out undefined conditions and use 'and' to combine them
      const finalConditions = conditions.filter(Boolean) as SQL<boolean>[];

      let query = db.select().from(tags).where(and(...finalConditions)).$dynamic();

      if (sortBy) {
        const orderBy = sortDirection === 'desc' ? desc : asc;
        switch (sortBy) {
          case 'name':
            query = query.orderBy(orderBy(tags.name));
            break;
          case 'createdAt':
            query = query.orderBy(orderBy(tags.createdAt));
            break;
          case 'updatedAt':
            query = query.orderBy(orderBy(tags.updatedAt));
            break;
          default:
            // Fallback or error if sortBy is unknown
            console.warn(`Unknown sortBy field: ${sortBy}`);
            break;
        }
      } else {
        // Default sort if no sortBy is provided
        query = query.orderBy(asc(tags.name));
      }

      const result = await query.all();
      console.log('Diagnostic: getTagsByStoryId fetched results:', result.map(tag => ({ id: tag.id, name: tag.name, isDeleted: tag.isDeleted, deletedAt: tag.deletedAt }))); // Diagnostic Log
      return result;
    },

    async getById(tagId: string): Promise<TagSelect | undefined> {
      return db.query.tags.findFirst({
        where: and(eq(tags.id, tagId), eq(tags.isDeleted, false)),
      });
    },

    async createTag(currentUserId: string, tagData: Create<TagInsert>): Promise<TagSelect> {
      const newTag = prepareNewEntityData<TagInsert>(tagData);
      const result = await db.insert(tags).values(newTag).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newTag.storyId, currentUserId);
      await recordLocalOperation(db, newTag.storyId, userIdToLog, 'create', 'Tag', newTag.id, { ...result });
      entityEventEmitter.emit('tag_changed', newTag.storyId, newTag.id); // Emit event after create

      return result;
    },

    async updateTag(currentUserId: string, tagId: string, tagData: Partial<Omit<TagInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void> {
      const originalTag = await db.query.tags.findFirst({ where: eq(tags.id, tagId) });
      if (!originalTag) {
        throw new Error(`Tag with ID ${tagId} not found for update.`);
      }

      const potentialNewState = { ...originalTag, ...tagData };

      const changes = getChangedFields(originalTag, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;

      if (Object.keys(changes).length === 0) {
        console.log(`No significant changes detected for tag ${tagId}. Skipping update and operation log.`);
        return;
      }

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
      entityEventEmitter.emit('tag_changed', updatedTag.storyId, updatedTag.id); // Emit event after update
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

      // Diagnostic: Re-fetch and log the tag's isDeleted status
      const reFetchedTag = await db.query.tags.findFirst({ where: eq(tags.id, tagId) });
      console.log(`Diagnostic: Tag ${tagId} isDeleted status after soft-delete: ${reFetchedTag?.isDeleted}`);

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedTag.storyId, currentUserId);
      await recordLocalOperation(db, updatedTag.storyId, userIdToLog, 'delete', 'Tag', tagId, {
        id: updatedTag.id,
        isDeleted: updatedTag.isDeleted,
        version: updatedTag.version,
      });
      entityEventEmitter.emit('tag_changed', updatedTag.storyId, updatedTag.id); // Emit event after delete
    },
  };
};