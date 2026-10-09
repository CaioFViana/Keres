import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'; // Import asc and desc
import type { AppDrizzleClient } from '../../db';
import type { TagInsert, TagSelect } from '../../db/schema';
import { tags } from '../../db/schema'; // Import TagInsert and stories
import type { AdvancedSearchCriteria, FavoriteFilterState } from '../../types/entityFilters';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils'; // Import Create and prepareNewEntityData
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService'; // Import ServerService and createServerService
import { buildNativeAdvancedSearchConditions } from './advancedSearchConditions';
import { countActiveStoryEntities } from './storyEntityCount';
import {
  decorateFavorite,
  normalizeFavoriteCreate,
  normalizeFavoriteUpdate,
  persistInitialFavorite,
} from './favoriteBehaviorUtils';
import { softDeleteRowSync } from './softDelete';

export type { FavoriteFilterState };

export interface TagService {
  getTagsByStoryId(
    storyId: string,
    searchTerm?: string,
    activeFilterTags?: string[],
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: AdvancedSearchCriteria,
  ): Promise<TagSelect[]>;
  getTagCount(storyId?: string): Promise<number>;
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
    async getTagCount(storyId?: string): Promise<number> {
      return countActiveStoryEntities(db, tags, storyId);
    },

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
      await assertStoryIsWritable(db, tagData.storyId);
      let newTag = prepareNewEntityData<TagInsert>(tagData);
      const favorite = await normalizeFavoriteCreate(db, newTag.storyId, 'Tag', newTag);
      newTag = favorite.data;
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newTag.storyId,
        currentUserId,
      );
      const result = await runLocalWrite(db, newTag.storyId, () => {
        const inserted = db.insert(tags).values(newTag).returning().get();
        recordLocalOperationSync(db, newTag.storyId, userIdToLog, 'create', 'Tag', newTag.id, {
          ...inserted,
        });
        return inserted;
      });
      // After the create, so its operation is never pushed ahead of the entity it points at.
      await persistInitialFavorite(
        db,
        newTag.storyId,
        newTag.id,
        'Tag',
        currentUserId,
        favorite.individualFavorite,
      );
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
      await assertStoryIsWritable(db, originalTag.storyId);
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

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        originalTag.storyId,
        currentUserId,
      );
      const updatedTag = await runLocalWrite(db, originalTag.storyId, () => {
        const updated = db
          .update(tags)
          .set({ ...tagData, updatedAt: new Date(), version: sql`${tags.version} + 1` })
          .where(eq(tags.id, tagId))
          .returning({ id: tags.id, storyId: tags.storyId, version: tags.version }) // Return relevant fields
          .get();

        if (!updated) {
          throw new Error(`Failed to update tag ${tagId} or tag not found.`);
        }

        // Log the diff already computed above, not the raw `tagData` input - the input has
        // every field the form sends, changed or not.
        recordLocalOperationSync(db, updated.storyId, userIdToLog, 'update', 'Tag', tagId, {
          ...changes,
          version: updated.version,
        });
        return updated;
      });
      entityEventEmitter.emit('tag_changed', updatedTag.storyId, updatedTag.id); // Emit event after update
    },

    async deleteTag(currentUserId: string, tagId: string): Promise<void> {
      const tagToDelete = await db.query.tags.findFirst({ where: eq(tags.id, tagId) });
      if (!tagToDelete) {
        console.warn(`Attempted to delete non-existent tag ${tagId}.`);
        return;
      }
      await assertStoryIsWritable(db, tagToDelete.storyId);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        tagToDelete.storyId,
        currentUserId,
      );
      const updatedTag = await runLocalWrite(db, tagToDelete.storyId, () => {
        const deleted = softDeleteRowSync(db, tags, 'Tag', tagId, userIdToLog);
        return deleted;
      });
      entityEventEmitter.emit('tag_changed', updatedTag.storyId, updatedTag.id); // Emit event after delete
    },
  };
};
