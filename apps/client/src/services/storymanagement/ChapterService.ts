import type { ChapterType } from '@keres/shared';
import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { ChapterInsert, ChapterSelect } from '../../db/schema';
import { chapters, stories } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperation,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import { buildAdvancedSearchConditions } from './advancedSearchConditions';
import { countActiveStoryEntities } from './storyEntityCount';
import { createStoryArcService } from './StoryArcService';
import type { FavoriteFilterState } from '../../types/entityFilters';
import { buildCustomAttributeSearchCondition } from '../../utils/attributeSearchPredicate';
import {
  decorateFavorite,
  normalizeFavoriteCreate,
  normalizeFavoriteUpdate,
  persistInitialFavorite,
} from './favoriteBehaviorUtils';

export type { FavoriteFilterState };

export interface ChapterService {
  getChaptersByStoryId(
    storyId: string,
    searchTerm?: string,
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: { [key: string]: any },
    /** Chapters unless asked otherwise; `null` returns both kinds in one list. */
    type?: ChapterType | null,
  ): Promise<ChapterSelect[]>;
  getChapterCount(storyId?: string): Promise<number>;
  getById(chapterId: string): Promise<ChapterSelect | undefined>;
  createChapter(currentUserId: string, chapterData: Create<ChapterInsert>): Promise<ChapterSelect>;
  updateChapter(
    currentUserId: string,
    chapterId: string,
    chapterData: Partial<
      Omit<
        ChapterInsert,
        'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >
    >,
  ): Promise<ChapterSelect>;
  deleteChapter(currentUserId: string, chapterId: string): Promise<void>;
  getAllByStoryId(storyId: string, type?: ChapterType | null): Promise<ChapterSelect[]>;
  /**
   * Reorders one kind of container.
   *
   * Chapters and events keep separate 1..N spaces inside the same table, so the operation carries
   * which one it means - the server filters on it before checking that the payload is complete and
   * contiguous, and a reorder that named the wrong kind would look like a short list to it.
   */
  reorderChapters(
    currentUserId: string,
    storyId: string,
    newOrder: { id: string; newIndex: number }[],
    type?: ChapterType,
  ): Promise<void>;
  /**
   * Moves a container between the two kinds.
   *
   * Three operations, in this order and all through the log: the row changes kind, the space it
   * left closes its gap, and the space it joined renumbers around it. The order is not cosmetic -
   * the server filters each reorder by kind, so it can only match the arrival against the target
   * space after the kind change has been applied.
   *
   * `position` is the 1-based slot in the target space, and only `event -> chapter` should ask for
   * one: the narrative spine has no natural place for a new arrival, so every position is an
   * assertion about the telling. Going the other way appends, because the event list is display
   * order and appending claims nothing about when it happened.
   */
  convertChapterType(
    currentUserId: string,
    chapterId: string,
    targetType: ChapterType,
    position?: number,
  ): Promise<void>;
}

export const createChapterService = (db: AppDrizzleClient): ChapterService => {
  const serverService = createServerService(db);
  return {
    async getChapterCount(storyId?: string): Promise<number> {
      return countActiveStoryEntities(db, chapters, storyId);
    },

    async getChaptersByStoryId(
      storyId,
      searchTerm,
      sortBy,
      sortDirection,
      favoriteFilterState,
      advancedSearchCriteria,
      type = 'chapter',
    ): Promise<ChapterSelect[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(chapters.storyId, storyId) as SQL<boolean>,
        eq(chapters.isDeleted, false) as SQL<boolean>,
      ];

      // `null` is an explicit "both kinds", which the drawer's combined list asks for. The default
      // is chapters, so every existing caller keeps meaning the narrative spine.
      if (type !== null) {
        conditions.push(eq(chapters.type, type) as SQL<boolean>);
      }

      if (searchTerm) {
        conditions.push(
          sql`${chapters.name} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>,
        );
      }

      if (favoriteFilterState === 'favorite') {
        conditions.push(eq(chapters.isFavorite, true) as SQL<boolean>);
      } else if (favoriteFilterState === 'not-favorite') {
        conditions.push(eq(chapters.isFavorite, false) as SQL<boolean>);
      }

      conditions.push(
        ...(await buildAdvancedSearchConditions(
          'Chapter',
          chapters,
          advancedSearchCriteria,
          (field, value) => buildCustomAttributeSearchCondition(db, chapters.id, field, value),
        )),
      );

      const finalConditions = conditions.filter(Boolean) as SQL<boolean>[];

      let query = db
        .select()
        .from(chapters)
        .where(and(...finalConditions))
        .$dynamic();

      /**
       * A combined list is grouped, events first, whatever the sort.
       *
       * Not decoration: the two kinds number independently, so chapter 1 and event 1 both exist and
       * a flat sort by index interleaves them into nonsense. Grouping first makes each block read as
       * its own sequence, which is what they are.
       */
      const groupByKind =
        type === null ? [sql`CASE WHEN ${chapters.type} = 'event' THEN 0 ELSE 1 END`] : [];

      if (sortBy) {
        const orderBy = sortDirection === 'desc' ? desc : asc;
        switch (sortBy) {
          case 'name':
            query = query.orderBy(...groupByKind, orderBy(chapters.name));
            break;
          case 'index':
            query = query.orderBy(...groupByKind, orderBy(chapters.index));
            break;
          case 'createdAt':
            query = query.orderBy(...groupByKind, orderBy(chapters.createdAt));
            break;
          case 'updatedAt':
            query = query.orderBy(...groupByKind, orderBy(chapters.updatedAt));
            break;
          default:
            console.warn(`Unknown sortBy field: ${sortBy}`);
            break;
        }
      } else {
        query = query.orderBy(...groupByKind, asc(chapters.index)); // Default sort by index
      }

      return query.all();
    },

    async getById(chapterId: string): Promise<ChapterSelect | undefined> {
      const chapter = await db.query.chapters.findFirst({
        where: and(eq(chapters.id, chapterId), eq(chapters.isDeleted, false)),
      });
      return decorateFavorite(db, 'Chapter', chapter);
    },

    async createChapter(
      currentUserId: string,
      chapterData: Create<ChapterInsert>,
    ): Promise<ChapterSelect> {
      await assertStoryIsWritable(db, chapterData.storyId);
      let newChapter = prepareNewEntityData<ChapterInsert>(chapterData);
      if (!newChapter.arcId) {
        const defaultArc = await createStoryArcService(db).ensureDefaultArc(
          currentUserId,
          newChapter.storyId,
        );
        newChapter = { ...newChapter, arcId: defaultArc.id };
      }
      const favorite = await normalizeFavoriteCreate(db, newChapter.storyId, 'Chapter', newChapter);
      newChapter = favorite.data;
      const result = await db.insert(chapters).values(newChapter).returning().get();
      await persistInitialFavorite(
        db,
        newChapter.storyId,
        newChapter.id,
        'Chapter',
        currentUserId,
        favorite.individualFavorite,
      );

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newChapter.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        newChapter.storyId,
        userIdToLog,
        'create',
        'Chapter',
        newChapter.id,
        { ...result },
      );
      entityEventEmitter.emit('chapter_changed', newChapter.storyId, newChapter.id);

      return result;
    },

    async updateChapter(
      currentUserId: string,
      chapterId: string,
      chapterData: Partial<
        Omit<
          ChapterInsert,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        >
      >,
    ): Promise<ChapterSelect> {
      const originalChapter = await db.query.chapters.findFirst({
        where: eq(chapters.id, chapterId),
      });
      if (!originalChapter) {
        throw new Error(`Chapter with ID ${chapterId} not found for update.`);
      }
      await assertStoryIsWritable(db, originalChapter.storyId);
      chapterData = await normalizeFavoriteUpdate(
        db,
        originalChapter.storyId,
        chapterId,
        'Chapter',
        currentUserId,
        chapterData,
      );

      const potentialNewState = { ...originalChapter, ...chapterData };

      const changes = getChangedFields(originalChapter, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;

      if (Object.keys(changes).length === 0) {
        console.log(
          `No significant changes detected for chapter ${chapterId}. Skipping update and operation log.`,
        );
        return originalChapter;
      }

      await db
        .update(chapters)
        .set({ ...chapterData, updatedAt: new Date(), version: sql`${chapters.version} + 1` })
        .where(eq(chapters.id, chapterId));

      const updatedChapter = await db.query.chapters.findFirst({
        where: eq(chapters.id, chapterId),
      });
      if (!updatedChapter) {
        throw new Error(`Failed to retrieve updated chapter ${chapterId}.`);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updatedChapter.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        updatedChapter.storyId,
        userIdToLog,
        'update',
        'Chapter',
        chapterId,
        getChangedFields(originalChapter, updatedChapter),
      );
      entityEventEmitter.emit('chapter_changed', updatedChapter.storyId, updatedChapter.id);

      return updatedChapter;
    },

    async deleteChapter(currentUserId: string, chapterId: string): Promise<void> {
      const chapterToDelete = await db.query.chapters.findFirst({
        where: eq(chapters.id, chapterId),
      });
      if (!chapterToDelete) {
        console.warn(`Attempted to delete non-existent chapter ${chapterId}.`);
        return;
      }
      await assertStoryIsWritable(db, chapterToDelete.storyId);

      const [updatedChapter] = await db
        .update(chapters)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
          version: sql`${chapters.version} + 1`,
        })
        .where(eq(chapters.id, chapterId))
        .returning({
          id: chapters.id,
          storyId: chapters.storyId,
          isDeleted: chapters.isDeleted,
          version: chapters.version,
        });

      if (!updatedChapter) {
        throw new Error(`Failed to delete chapter ${chapterId} or chapter not found.`);
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        updatedChapter.storyId,
        currentUserId,
      );
      await recordLocalOperation(
        db,
        updatedChapter.storyId,
        userIdToLog,
        'delete',
        'Chapter',
        chapterId,
        {
          id: updatedChapter.id,
          isDeleted: updatedChapter.isDeleted,
          version: updatedChapter.version,
        },
      );
      entityEventEmitter.emit('chapter_changed', updatedChapter.storyId, updatedChapter.id);
    },

    async getAllByStoryId(
      storyId: string,
      type: ChapterType | null = 'chapter',
    ): Promise<ChapterSelect[]> {
      if (!storyId) {
        console.error('getAllByStoryId: storyId is required.');
        return [];
      }
      try {
        const allChapters = await db
          .select()
          .from(chapters)
          .where(
            and(
              eq(chapters.storyId, storyId),
              eq(chapters.isDeleted, false),
              type === null ? undefined : eq(chapters.type, type),
            ),
          )
          .orderBy(
            ...(type === null ? [sql`CASE WHEN ${chapters.type} = 'event' THEN 0 ELSE 1 END`] : []),
            asc(chapters.index),
          )
          .all();
        return allChapters;
      } catch (error) {
        console.error(`Error fetching all chapters for story ${storyId}:`, error);
        return [];
      }
    },

    async reorderChapters(
      currentUserId: string,
      storyId: string,
      newOrder: { id: string; newIndex: number }[],
      type: ChapterType = 'chapter',
    ): Promise<void> {
      await assertStoryIsWritable(db, storyId);
      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);

      await db.transaction(async (tx) => {
        for (const chapter of newOrder) {
          const originalChapter = await tx.query.chapters.findFirst({
            where: eq(chapters.id, chapter.id),
          });
          if (!originalChapter) {
            console.warn(`Chapter with ID ${chapter.id} not found during reorder.`);
            continue;
          }

          if (originalChapter.index !== chapter.newIndex) {
            // Compare with chapter.newIndex
            await tx
              .update(chapters)
              .set({
                index: chapter.newIndex, // Use chapter.newIndex
                updatedAt: new Date(),
                version: sql`${chapters.version} + 1`,
              })
              .where(eq(chapters.id, chapter.id));
          }
        }
      });
      const [story] = await db
        .update(stories)
        .set({ version: sql`${stories.version} + 1`, updatedAt: new Date() })
        .where(eq(stories.id, storyId))
        .returning({ version: stories.version });

      await recordLocalOperation(db, storyId, userIdToLog, 'reorder', 'Story', storyId, {
        reorderItems: newOrder.map((item) => ({ id: item.id, newIndex: item.newIndex })),
        // Absent for chapters, which is what this operation meant before events existed - an old
        // server reads such a payload exactly as it always did.
        ...(type === 'event' ? { reorderTarget: 'Event' as const } : {}),
        version: story?.version,
      });
      entityEventEmitter.emit('chapter_changed', storyId, 'reorder');
    },

    async convertChapterType(currentUserId, chapterId, targetType, position) {
      const chapter = await db.query.chapters.findFirst({
        where: and(eq(chapters.id, chapterId), eq(chapters.isDeleted, false)),
      });
      if (!chapter) throw new Error(`Chapter with ID ${chapterId} not found for conversion.`);
      if (chapter.type === targetType) return;

      const storyId = chapter.storyId;
      await assertStoryIsWritable(db, storyId);
      const userIdToLog = await getUserIdForOperation(db, serverService, storyId, currentUserId);

      const liveOf = async (type: ChapterType) =>
        db
          .select({ id: chapters.id, index: chapters.index })
          .from(chapters)
          .where(
            and(
              eq(chapters.storyId, storyId),
              eq(chapters.type, type),
              eq(chapters.isDeleted, false),
            ),
          )
          .orderBy(asc(chapters.index))
          .all();

      const sourceRemaining = (await liveOf(chapter.type)).filter((row) => row.id !== chapterId);
      const targetExisting = await liveOf(targetType);

      // Clamped rather than refused: an out-of-range slot is a caller bug, and landing at the end
      // is a result the writer can see and fix, unlike an exception on a screen.
      const slot = Math.min(
        Math.max(position ?? targetExisting.length + 1, 1),
        targetExisting.length + 1,
      );
      const targetOrder = [
        ...targetExisting.slice(0, slot - 1),
        { id: chapterId, index: 0 },
        ...targetExisting.slice(slot - 1),
      ];

      const renumber = (rows: { id: string }[]) =>
        rows.map((row, position2) => ({ id: row.id, newIndex: position2 + 1 }));
      const sourceOrder = renumber(sourceRemaining);
      const arrivedOrder = renumber(targetOrder);

      await db.transaction(async (tx) => {
        await tx
          .update(chapters)
          .set({
            type: targetType,
            index: slot,
            updatedAt: new Date(),
            version: sql`${chapters.version} + 1`,
          })
          .where(eq(chapters.id, chapterId));

        for (const item of [...sourceOrder, ...arrivedOrder]) {
          if (item.id === chapterId) continue;
          await tx
            .update(chapters)
            .set({
              index: item.newIndex,
              updatedAt: new Date(),
              version: sql`${chapters.version} + 1`,
            })
            .where(eq(chapters.id, item.id));
        }
      });

      const updatedChapter = await db.query.chapters.findFirst({
        where: eq(chapters.id, chapterId),
      });
      // The kind change goes first: the server matches each reorder against one kind, so it can
      // only find the arrival in the target space once this has been applied.
      await recordLocalOperation(db, storyId, userIdToLog, 'update', 'Chapter', chapterId, {
        type: targetType,
        version: updatedChapter?.version,
      });

      const bumpStory = async () => {
        const [story] = await db
          .update(stories)
          .set({ version: sql`${stories.version} + 1`, updatedAt: new Date() })
          .where(eq(stories.id, storyId))
          .returning({ version: stories.version });
        return story?.version;
      };

      // An empty space needs no reorder: the server would refuse a payload of nothing to compare.
      if (sourceOrder.length > 0) {
        await recordLocalOperation(db, storyId, userIdToLog, 'reorder', 'Story', storyId, {
          reorderItems: sourceOrder,
          ...(chapter.type === 'event' ? { reorderTarget: 'Event' as const } : {}),
          version: await bumpStory(),
        });
      }
      await recordLocalOperation(db, storyId, userIdToLog, 'reorder', 'Story', storyId, {
        reorderItems: arrivedOrder,
        ...(targetType === 'event' ? { reorderTarget: 'Event' as const } : {}),
        version: await bumpStory(),
      });

      entityEventEmitter.emit('chapter_changed', storyId, chapterId);
    },
  };
};
