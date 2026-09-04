import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'; // Import asc and desc
import type { AppDrizzleClient } from '../../db';
import type { TagInsert, TagSelect } from '../../db/schema';
import { tags } from '../../db/schema'; // Import TagInsert and stories
import type { FavoriteFilterState } from '../../types/entityFilters';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils'; // Import Create and prepareNewEntityData
import { entityEventEmitter } from '../../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../../utils/syncUtils'; // Import recordLocalOperation and getUserIdForOperation
import { createServerService } from '../ServerService'; // Import ServerService and createServerService
import { buildNativeAdvancedSearchConditions } from './advancedSearchConditions';
import {
  decorateFavorite,
  normalizeFavoriteCreate,
  normalizeFavoriteUpdate,
  persistInitialFavorite,
} from './favoriteBehaviorUtils';

export type { FavoriteFilterState };

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
  updateTag(
    currentUserId: string,
    tagId: string,
    tagData: Partial<
      Omit<
        TagInsert,
        'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >
    >,
  ): Promise<void>;
  deleteTag(currentUserId: string, tagId: string): Promise<void>;
}

export const createTagService = (db: AppDrizzleClient): TagService => {
  const serverService = createServerService(db); // Create serverService once
  return {
    async getTagsByStoryId(
      storyId,
      searchTerm,
      activeFilterTags,
      sortBy,
      sortDirection,
      favoriteFilterState,
      advancedSearchCriteria,
    ): Promise<TagSelect[]> {
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

      conditions.push(...buildNativeAdvancedSearchConditions('Tag', tags, advancedSearchCriteria));

      // Filter out undefined conditions and use 'and' to combine them
      const finalConditions = conditions.filter(Boolean) as SQL<boolean>[];

      let query = db
        .select()
        .from(tags)
        .where(and(...finalConditions))
        .$dynamic();

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
      return result;
    },

    async getById(tagId: string): Promise<TagSelect | undefined> {
      const tag = await db.query.tags.findFirst({
        where: and(eq(tags.id, tagId), eq(tags.isDeleted, false)),
      });
      return decorateFavorite(db, 'Tag', tag);
    },

    async createTag(currentUserId: string, tagData: Create<TagInsert>): Promise<TagSelect> {
      let newTag = prepareNewEntityData<TagInsert>(tagData);
      const favorite = await normalizeFavoriteCreate(db, newTag.storyId, 'Tag', newTag);
      newTag = favorite.data;
      const result = await db.insert(tags).values(newTag).returning().get();
      await persistInitialFavorite(
        db,
        newTag.storyId,
        newTag.id,
        'Tag',
        currentUserId,
        favorite.individualFavorite,
      );

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newTag.storyId,
        currentUserId,
      );
      await recordLocalOperation(db, newTag.storyId, userIdToLog, 'create', 'Tag', newTag.id, {
        ...result,
      });
      entityEventEmitter.emit('tag_changed', newTag.storyId, newTag.id); // Emit event after create

      return result;
    },

    async updateTag(
      currentUserId: string,
      tagId: string,
      tagData: Partial<
        Omit<
          TagInsert,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        >
      >,
    ): Promise<void> {
      const originalTag = await db.query.tags.findFirst({ where: eq(tags.id, tagId) });
      if (!originalTag) {
        throw new Error(`Tag with ID ${tagId} not found for update.`);
      }
      tagData = await normalizeFavoriteUpdate(
        db,
        originalTag.storyId,
        tagId,
        'Tag',
        currentUserId,
        tagData,
      );

      const potentialNewState = { ...originalTag, ...tagData };

      const changes = getChangedFields(originalTag, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;

      if (Object.keys(changes).length === 0) {
        console.log(
          `No significant changes detected for tag ${tagId}. Skipping update and operation log.`,
        );
        return;
      }

      const [updatedTag] = await db
        .update(tags)
        .set({ ...tagData, updatedAt: new Date(), version: sql`${tags.version} + 1` })
        .where(eq(tags.id, tagId))
        .returning({ id: tags.id, storyId: tags.storyId, version: tags.version }); // Return relevant fields

      if (!updatedTag) {
        throw new Error(`Failed to update tag ${tagId} or tag not found.`);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updatedTag.storyId,
        currentUserId,
      );
      // Log the diff already computed above, not the raw `tagData` input - the input has
      // every field the form sends, changed or not.
      await recordLocalOperation(db, updatedTag.storyId, userIdToLog, 'update', 'Tag', tagId, {
        ...changes,
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

      const [updatedTag] = await db
        .update(tags)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${tags.version} + 1`,
        })
        .where(eq(tags.id, tagId))
        .returning({
          id: tags.id,
          storyId: tags.storyId,
          isDeleted: tags.isDeleted,
          version: tags.version,
        });

      if (!updatedTag) {
        throw new Error(`Failed to delete tag ${tagId} or tag not found.`);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updatedTag.storyId,
        currentUserId,
      );
      await recordLocalOperation(db, updatedTag.storyId, userIdToLog, 'delete', 'Tag', tagId, {
        id: updatedTag.id,
        isDeleted: updatedTag.isDeleted,
        version: updatedTag.version,
      });
      entityEventEmitter.emit('tag_changed', updatedTag.storyId, updatedTag.id); // Emit event after delete
    },
  };
};
