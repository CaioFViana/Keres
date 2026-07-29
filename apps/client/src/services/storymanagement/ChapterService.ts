import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { and, asc, desc, eq, sql, SQL } from 'drizzle-orm';
import { AppDrizzleClient } from '../../db';
import { ChapterInsert, chapters, ChapterSelect } from '../../db/schema';
import { Create, getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import type { FavoriteFilterState } from '../../types/entityFilters';

export type { FavoriteFilterState };

export interface ChapterService {
  getChaptersByStoryId(
    storyId: string,
    searchTerm?: string,
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: { [key: string]: any },
  ): Promise<ChapterSelect[]>;
  getById(chapterId: string): Promise<ChapterSelect | undefined>;
  createChapter(currentUserId: string, chapterData: Create<ChapterInsert>): Promise<ChapterSelect>;
  updateChapter(currentUserId: string, chapterId: string, chapterData: Partial<Omit<ChapterInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<ChapterSelect>;
  deleteChapter(currentUserId: string, chapterId: string): Promise<void>;
  getAllByStoryId(storyId: string): Promise<ChapterSelect[]>;
  reorderChapters(currentUserId: string, storyId: string, newOrder: { id: string, newIndex: number }[]): Promise<void>;
}

export const createChapterService = (db: AppDrizzleClient): ChapterService => {
  const serverService = createServerService(db);
  return {
    async getChaptersByStoryId(
      storyId,
      searchTerm,
      sortBy,
      sortDirection,
      favoriteFilterState,
      advancedSearchCriteria
    ): Promise<ChapterSelect[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(chapters.storyId, storyId) as SQL<boolean>,
        eq(chapters.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        conditions.push(sql`${chapters.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>);
      }

      if (favoriteFilterState === 'favorite') {
        conditions.push(eq(chapters.isFavorite, true) as SQL<boolean>);
      } else if (favoriteFilterState === 'not-favorite') {
        conditions.push(eq(chapters.isFavorite, false) as SQL<boolean>);
      }

      if (advancedSearchCriteria && Object.keys(advancedSearchCriteria).length > 0) {
        const chapterMetadata = entityFieldMetadata['Chapter'];
        for (const key in advancedSearchCriteria) {
          if (Object.prototype.hasOwnProperty.call(advancedSearchCriteria, key)) {
            const value = advancedSearchCriteria[key];
            const fieldMeta = chapterMetadata.find(meta => meta.name === key);

            if (value !== undefined && value !== '' && fieldMeta) {
              if (fieldMeta.type === 'string') {
                conditions.push(sql`${chapters[key as keyof ChapterSelect]} LIKE ${`%${value}%`} COLLATE NOCASE` as SQL<boolean>);
              } else if (fieldMeta.type === 'boolean') {
                conditions.push(eq(chapters[key as keyof ChapterSelect], value) as SQL<boolean>);
              } else if (fieldMeta.type === 'number') {
                conditions.push(eq(chapters[key as keyof ChapterSelect], Number(value)) as SQL<boolean>);
              }
            }
          }
        }
      }

      const finalConditions = conditions.filter(Boolean) as SQL<boolean>[];

      let query = db.select().from(chapters).where(and(...finalConditions)).$dynamic();

      if (sortBy) {
        const orderBy = sortDirection === 'desc' ? desc : asc;
        switch (sortBy) {
          case 'name':
            query = query.orderBy(orderBy(chapters.name));
            break;
          case 'index':
            query = query.orderBy(orderBy(chapters.index));
            break;
          case 'createdAt':
            query = query.orderBy(orderBy(chapters.createdAt));
            break;
          case 'updatedAt':
            query = query.orderBy(orderBy(chapters.updatedAt));
            break;
          default:
            console.warn(`Unknown sortBy field: ${sortBy}`);
            break;
        }
      } else {
        query = query.orderBy(asc(chapters.index)); // Default sort by index
      }

      return query.all();
    },

    async getById(chapterId: string): Promise<ChapterSelect | undefined> {
      return db.query.chapters.findFirst({
        where: and(eq(chapters.id, chapterId), eq(chapters.isDeleted, false)),
      });
    },

    async createChapter(currentUserId: string, chapterData: Create<ChapterInsert>): Promise<ChapterSelect> {
      const newChapter = prepareNewEntityData<ChapterInsert>(chapterData);
      const result = await db.insert(chapters).values(newChapter).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newChapter.storyId, currentUserId);
      await recordLocalOperation(db, newChapter.storyId, userIdToLog, 'create', 'Chapter', newChapter.id, { ...result });
      entityEventEmitter.emit('chapter_changed', newChapter.storyId, newChapter.id);

      return result;
    },

    async updateChapter(currentUserId: string, chapterId: string, chapterData: Partial<Omit<ChapterInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<ChapterSelect> {
      const originalChapter = await db.query.chapters.findFirst({ where: eq(chapters.id, chapterId) });
      if (!originalChapter) {
        throw new Error(`Chapter with ID ${chapterId} not found for update.`);
      }

      const potentialNewState = { ...originalChapter, ...chapterData };

      const changes = getChangedFields(originalChapter, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;

      if (Object.keys(changes).length === 0) {
        console.log(`No significant changes detected for chapter ${chapterId}. Skipping update and operation log.`);
        return originalChapter;
      }

      await db.update(chapters)
        .set({ ...chapterData, updatedAt: new Date(), version: sql`${chapters.version} + 1` })
        .where(eq(chapters.id, chapterId));

      const updatedChapter = await db.query.chapters.findFirst({ where: eq(chapters.id, chapterId) });
      if (!updatedChapter) {
        throw new Error(`Failed to retrieve updated chapter ${chapterId}.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedChapter.storyId, currentUserId);
      await recordLocalOperation(db, updatedChapter.storyId, userIdToLog, 'update', 'Chapter', chapterId, getChangedFields(originalChapter, updatedChapter));
      entityEventEmitter.emit('chapter_changed', updatedChapter.storyId, updatedChapter.id);

      return updatedChapter;
    },

    async deleteChapter(currentUserId: string, chapterId: string): Promise<void> {
      const chapterToDelete = await db.query.chapters.findFirst({ where: eq(chapters.id, chapterId) });
      if (!chapterToDelete) {
        console.warn(`Attempted to delete non-existent chapter ${chapterId}.`);
        return;
      }

      const [updatedChapter] = await db.update(chapters)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${chapters.version} + 1` })
        .where(eq(chapters.id, chapterId))
        .returning({ id: chapters.id, storyId: chapters.storyId, isDeleted: chapters.isDeleted, version: chapters.version });

      if (!updatedChapter) {
        throw new Error(`Failed to delete chapter ${chapterId} or chapter not found.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedChapter.storyId, currentUserId);
      await recordLocalOperation(db, updatedChapter.storyId, userIdToLog, 'delete', 'Chapter', chapterId, {
        id: updatedChapter.id,
        isDeleted: updatedChapter.isDeleted,
        version: updatedChapter.version,
      });
      entityEventEmitter.emit('chapter_changed', updatedChapter.storyId, updatedChapter.id);
    },

    async getAllByStoryId(storyId: string): Promise<ChapterSelect[]> {
      if (!storyId) {
        console.error('getAllByStoryId: storyId is required.');
        return [];
      }
      try {
        const allChapters = await db.select()
          .from(chapters)
          .where(and(eq(chapters.storyId, storyId), eq(chapters.isDeleted, false)))
          .orderBy(asc(chapters.index))
          .all();
        return allChapters;
      } catch (error) {
        console.error(`Error fetching all chapters for story ${storyId}:`, error);
        return [];
      }
    },

    async reorderChapters(currentUserId: string, storyId: string, newOrder: { id: string, newIndex: number }[]): Promise<void> {
      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);
      const reorderPayload = { reorderItems: newOrder.map(item => ({ id: item.id, newIndex: item.newIndex })) };

      await db.transaction(async (tx) => {
        for (const chapter of newOrder) {
          const originalChapter = await tx.query.chapters.findFirst({ where: eq(chapters.id, chapter.id) });
          if (!originalChapter) {
            console.warn(`Chapter with ID ${chapter.id} not found during reorder.`);
            continue;
          }

          if (originalChapter.index !== chapter.newIndex) { // Compare with chapter.newIndex
            await tx.update(chapters)
              .set({
                index: chapter.newIndex, // Use chapter.newIndex
                updatedAt: new Date(),
                version: sql`${chapters.version} + 1`
              })
              .where(eq(chapters.id, chapter.id));
          }
        }
      });
      // Record a single 'reorder' operation for the entire list
      await recordLocalOperation(db, storyId, userIdToLog, 'reorder', 'Story', storyId, reorderPayload);
      entityEventEmitter.emit('chapter_changed', storyId, 'reorder');
    },
  };
};