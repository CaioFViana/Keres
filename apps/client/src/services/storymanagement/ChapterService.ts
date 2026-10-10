import type { ChapterType } from '@keres/shared';
import type { SQL } from 'drizzle-orm';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import type { ChapterInsert, ChapterSelect } from '../../db/schema';
import { chapters } from '../../db/schema';
import type { Create } from '../../utils/entityUtils';
import { getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import { buildAdvancedSearchConditions } from './advancedSearchConditions';
import { countActiveStoryEntities } from './storyEntityCount';
import { applyKeyedListSort, storyEntityConditions } from './storyEntityListQuery';
import { createStoryArcService } from './StoryArcService';
import { planContainerOrderSync, planPlacementSync, writeRankChangesSync } from './arrangedWrites';
import type { AdvancedSearchCriteria, FavoriteFilterState } from '../../types/entityFilters';
import { buildCustomAttributeSearchCondition } from '../../utils/attributeSearchPredicate';
import {
  decorateFavorite,
  normalizeFavoriteCreate,
  normalizeFavoriteUpdate,
  persistInitialFavorite,
} from './favoriteBehaviorUtils';
import { softDeleteRowSync } from './softDelete';

export type { FavoriteFilterState };

export interface ChapterService {
  getChaptersByStoryId(
    storyId: string,
    searchTerm?: string,
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: AdvancedSearchCriteria,
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
   * Reorders one kind of container. Chapters and events keep separate 1..N spaces inside the same
   * table; each container that moved takes the rank of its new place among its kind.
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
   * One edit of the row - its kind and its rank in the space it joins; both spaces renumber from
   * their live rows' ranks by themselves.
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
      const conditions: SQL<boolean>[] = storyEntityConditions(chapters, storyId, {
        searchColumn: chapters.name,
        searchTerm,
        favoriteFilterState,
      });

      // `null` is an explicit "both kinds", which the drawer's combined list asks for. The default
      // is chapters, so every existing caller keeps meaning the narrative spine.
      if (type !== null) {
        conditions.push(eq(chapters.type, type) as SQL<boolean>);
      }

      conditions.push(
        ...(await buildAdvancedSearchConditions(
          'Chapter',
          chapters,
          advancedSearchCriteria,
          (field, value) => buildCustomAttributeSearchCondition(db, chapters.id, field, value),
        )),
      );

      const query = db
        .select()
        .from(chapters)
        .where(and(...conditions))
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

      const sorted = applyKeyedListSort(
        query,
        sortBy,
        sortDirection,
        {
          name: chapters.name,
          index: chapters.index,
          createdAt: chapters.createdAt,
          updatedAt: chapters.updatedAt,
        },
        chapters.index, // Default sort by index
        groupByKind,
      );

      return sorted.all();
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
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newChapter.storyId,
        currentUserId,
      );
      const result = await runLocalWrite(db, newChapter.storyId, () => {
        // The asked index is where it goes among its kind; the database numbers it from its rank.
        const container = { type: newChapter.type ?? 'chapter' };
        const placement = planPlacementSync(
          db,
          'Chapter',
          newChapter.storyId,
          container,
          newChapter.id,
          typeof newChapter.index === 'number' ? newChapter.index - 1 : undefined,
        );
        db.insert(chapters)
          .values({ ...newChapter, rank: placement.get(newChapter.id)! })
          .run();
        // Recorded as the database holds it: its number already derived from its rank.
        const inserted = db.select().from(chapters).where(eq(chapters.id, newChapter.id)).get()!;
        recordLocalOperationSync(
          db,
          newChapter.storyId,
          userIdToLog,
          'create',
          'Chapter',
          newChapter.id,
          { ...inserted },
        );
        writeRankChangesSync(
          db,
          newChapter.storyId,
          userIdToLog,
          'Chapter',
          placement,
          new Set([newChapter.id]),
        );
        return db.select().from(chapters).where(eq(chapters.id, newChapter.id)).get()!;
      });
      // After the create, so its operation is never pushed ahead of the entity it points at.
      await persistInitialFavorite(
        db,
        newChapter.storyId,
        newChapter.id,
        'Chapter',
        currentUserId,
        favorite.individualFavorite,
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
      // A container's place is its rank (reorderChapters, convertChapterType), never a form field.
      const { index: _index, rank: _rank, ...placeless } = chapterData;
      chapterData = placeless;
      const kindChanging =
        chapterData.type !== undefined && chapterData.type !== originalChapter.type;
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

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        originalChapter.storyId,
        currentUserId,
      );
      const updatedChapter = await runLocalWrite(db, originalChapter.storyId, () => {
        // Changing kind changes list: it enters at the end of the other kind's.
        const placement = kindChanging
          ? planPlacementSync(
              db,
              'Chapter',
              originalChapter.storyId,
              { type: chapterData.type! },
              chapterId,
            )
          : undefined;
        db.update(chapters)
          .set({
            ...chapterData,
            ...(placement ? { rank: placement.get(chapterId)! } : {}),
            updatedAt: new Date(),
            version: sql`${chapters.version} + 1`,
          })
          .where(eq(chapters.id, chapterId))
          .run();
        const updated = db.select().from(chapters).where(eq(chapters.id, chapterId)).get();
        if (!updated) {
          throw new Error(`Failed to retrieve updated chapter ${chapterId}.`);
        }
        recordLocalOperationSync(db, updated.storyId, userIdToLog, 'update', 'Chapter', chapterId, {
          ...getChangedFields(originalChapter, updated),
          ...(placement ? { rank: updated.rank } : {}),
        });
        if (placement) {
          writeRankChangesSync(
            db,
            updated.storyId,
            userIdToLog,
            'Chapter',
            placement,
            new Set([chapterId]),
          );
        }
        return updated;
      });
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
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        chapterToDelete.storyId,
        currentUserId,
      );

      const updatedChapter = await runLocalWrite(db, chapterToDelete.storyId, () => {
        const deleted = softDeleteRowSync(db, chapters, 'Chapter', chapterId, userIdToLog);
        return deleted;
      });
      entityEventEmitter.emit('chapter_changed', updatedChapter.storyId, updatedChapter.id);
      // Its scenes now read as unchaptered (`SceneService`), so every scene list refreshes.
      entityEventEmitter.emit('scene_changed', updatedChapter.storyId);
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
      // Only the containers that moved are edited: each takes the rank of its new place.
      await runLocalWrite(db, storyId, () => {
        const orderedIds = [...newOrder]
          .sort((left, right) => left.newIndex - right.newIndex)
          .map((item) => item.id);
        const changes = planContainerOrderSync(db, 'Chapter', storyId, { type }, orderedIds);
        writeRankChangesSync(db, storyId, userIdToLog, 'Chapter', changes);
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

      // One edit of the row: its kind and its rank among the kind it joins. The list it left
      // closes its gap by itself, since both lists number from their live rows' ranks.
      await runLocalWrite(db, storyId, () => {
        const placement = planPlacementSync(
          db,
          'Chapter',
          storyId,
          { type: targetType },
          chapterId,
          // Clamped by the placement: an out-of-range slot lands at the end, visibly.
          position === undefined ? undefined : position - 1,
        );
        const updated = db
          .update(chapters)
          .set({
            type: targetType,
            rank: placement.get(chapterId)!,
            updatedAt: new Date(),
            version: sql`${chapters.version} + 1`,
          })
          .where(eq(chapters.id, chapterId))
          .returning({ version: chapters.version, rank: chapters.rank })
          .get();
        recordLocalOperationSync(db, storyId, userIdToLog, 'update', 'Chapter', chapterId, {
          type: targetType,
          rank: updated?.rank,
          version: updated?.version,
        });
        writeRankChangesSync(db, storyId, userIdToLog, 'Chapter', placement, new Set([chapterId]));
      });

      entityEventEmitter.emit('chapter_changed', storyId, chapterId);
    },
  };
};
