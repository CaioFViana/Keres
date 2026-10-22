import type { SQL } from 'drizzle-orm';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '@/src/db';
import type { ChoiceInsert, ChoiceSelect } from '@/src/db/schemas/choices';
import { choices } from '@/src/db/schemas/choices';
import { scenes } from '@/src/db/schemas/scenes';
import { stories } from '@/src/db/schemas/stories';
import type { Create } from '@/src/utils/entity/entityUtils';
import { getChangedFields, prepareNewEntityData } from '@/src/utils/entity/entityUtils';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import {
  assertStoryIsWritable,
  getUserIdForOperation,
  recordLocalOperationSync,
  runLocalWrite,
} from '@/src/services/sync/syncUtils';
import { createServerService } from '@/src/services/servers/ServerService';
import type { AdvancedSearchCriteria } from '@/src/types/entityFilters';
import { buildNativeAdvancedSearchConditions } from '@/src/services/storymanagement/story-lifecycle/advancedSearchConditions';
import {
  applyListSort,
  storyEntityConditions,
} from '@/src/services/storymanagement/story-lifecycle/storyEntityListQuery';
import { softDeleteRowSync } from '@/src/db/softDelete';
import { logger } from '@/src/utils/logging/logger';

export interface ChoiceService {
  getChoicesByStoryId(
    storyId: string,
    searchTerm?: string,
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    advancedSearchCriteria?: AdvancedSearchCriteria,
  ): Promise<ChoiceSelect[]>;
  getChoiceCount(storyId?: string): Promise<number>;
  getById(choiceId: string): Promise<ChoiceSelect | undefined>;
  createChoice(currentUserId: string, choiceData: Create<ChoiceInsert>): Promise<ChoiceSelect>;
  updateChoice(
    currentUserId: string,
    choiceId: string,
    choiceData: Partial<
      Omit<
        ChoiceInsert,
        'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >
    >,
  ): Promise<ChoiceSelect>;
  deleteChoice(currentUserId: string, choiceId: string): Promise<void>;
  getAllByStoryId(storyId: string): Promise<ChoiceSelect[]>;
}

export const createChoiceService = (db: AppDrizzleClient): ChoiceService => {
  const serverService = createServerService(db);

  return {
    async getChoiceCount(storyId?: string): Promise<number> {
      const conditions = [
        eq(stories.isDeleted, false),
        eq(scenes.isDeleted, false),
        eq(choices.isDeleted, false),
      ];
      if (storyId) conditions.push(eq(stories.id, storyId));
      const result = await db
        .select({ count: count() })
        .from(choices)
        .innerJoin(scenes, eq(choices.sceneId, scenes.id))
        .innerJoin(stories, eq(scenes.storyId, stories.id))
        .where(and(...conditions))
        .get();
      return result?.count ?? 0;
    },

    async getChoicesByStoryId(
      storyId,
      searchTerm,
      sortBy,
      sortDirection,
      advancedSearchCriteria,
    ): Promise<ChoiceSelect[]> {
      const conditions: SQL<boolean>[] = storyEntityConditions(choices, storyId, {
        searchColumn: choices.text,
        searchTerm,
      });

      if (advancedSearchCriteria && Object.keys(advancedSearchCriteria).length > 0) {
        const { chapterId, sceneId, nextSceneId, ...otherCriteria } = advancedSearchCriteria;

        if (sceneId) {
          conditions.push(eq(choices.sceneId, sceneId) as SQL<boolean>);
        } else if (chapterId) {
          const sceneIdsInChapter = db
            .select({ id: scenes.id })
            .from(scenes)
            .where(and(eq(scenes.chapterId, chapterId), eq(scenes.isDeleted, false)));
          conditions.push(inArray(choices.sceneId, sceneIdsInChapter) as SQL<boolean>);
        }

        if (nextSceneId) {
          conditions.push(eq(choices.nextSceneId, nextSceneId) as SQL<boolean>);
        }

        conditions.push(...buildNativeAdvancedSearchConditions('Choice', choices, otherCriteria));

        const choiceSearch = otherCriteria.choiceSearch;
        if (choiceSearch !== undefined && choiceSearch !== null && choiceSearch !== '') {
          conditions.push(
            sql`(${choices.text} LIKE ${`%${choiceSearch}%`} COLLATE NOCASE OR ${choices.notes} LIKE ${`%${choiceSearch}%`} COLLATE NOCASE)` as SQL<boolean>,
          );
        }
      }

      const query = db
        .select()
        .from(choices)
        .where(and(...conditions))
        .$dynamic();

      return applyListSort(query, choices, sortBy, sortDirection).all();
    },

    async getById(choiceId: string): Promise<ChoiceSelect | undefined> {
      return db.query.choices.findFirst({
        where: and(eq(choices.id, choiceId), eq(choices.isDeleted, false)),
      });
    },

    async createChoice(
      currentUserId: string,
      choiceData: Create<ChoiceInsert>,
    ): Promise<ChoiceSelect> {
      await assertStoryIsWritable(db, choiceData.storyId);
      const newChoice = prepareNewEntityData<ChoiceInsert>(choiceData);
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newChoice.storyId,
        currentUserId,
      );
      const result = await runLocalWrite(db, newChoice.storyId, () => {
        const inserted = db.insert(choices).values(newChoice).returning().get();
        recordLocalOperationSync(
          db,
          newChoice.storyId,
          userIdToLog,
          'create',
          'Choice',
          newChoice.id,
          { ...inserted },
        );
        return inserted;
      });
      entityEventEmitter.emit('choice_changed', newChoice.storyId, newChoice.id);
      return result;
    },

    async updateChoice(
      currentUserId: string,
      choiceId: string,
      choiceData: Partial<
        Omit<
          ChoiceInsert,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        >
      >,
    ): Promise<ChoiceSelect> {
      const originalChoice = await db.query.choices.findFirst({ where: eq(choices.id, choiceId) });
      if (!originalChoice) throw new Error(`Choice with ID ${choiceId} not found for update.`);
      await assertStoryIsWritable(db, originalChoice.storyId);
      const potentialNewState = { ...originalChoice, ...choiceData };
      const changes = getChangedFields(originalChoice, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;
      if (Object.keys(changes).length === 0) return originalChoice;

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        originalChoice.storyId,
        currentUserId,
      );
      const updatedChoice = await runLocalWrite(db, originalChoice.storyId, () => {
        db.update(choices)
          .set({ ...choiceData, updatedAt: new Date(), version: sql`${choices.version} + 1` })
          .where(eq(choices.id, choiceId))
          .run();
        const updated = db.select().from(choices).where(eq(choices.id, choiceId)).get();
        if (!updated) throw new Error(`Failed to retrieve updated choice ${choiceId}.`);
        recordLocalOperationSync(
          db,
          updated.storyId,
          userIdToLog,
          'update',
          'Choice',
          choiceId,
          getChangedFields(originalChoice, updated),
        );
        return updated;
      });
      entityEventEmitter.emit('choice_changed', updatedChoice.storyId, updatedChoice.id);
      return updatedChoice;
    },

    async deleteChoice(currentUserId: string, choiceId: string): Promise<void> {
      const choiceToDelete = await db.query.choices.findFirst({ where: eq(choices.id, choiceId) });
      if (!choiceToDelete) return;
      await assertStoryIsWritable(db, choiceToDelete.storyId);
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        choiceToDelete.storyId,
        currentUserId,
      );
      const updatedChoice = await runLocalWrite(db, choiceToDelete.storyId, () => {
        const deleted = softDeleteRowSync(db, choices, 'Choice', choiceId, userIdToLog);
        return deleted;
      });
      entityEventEmitter.emit('choice_changed', updatedChoice.storyId, updatedChoice.id);
    },

    async getAllByStoryId(storyId: string): Promise<ChoiceSelect[]> {
      if (!storyId) return [];
      try {
        return await db
          .select()
          .from(choices)
          .where(and(eq(choices.storyId, storyId), eq(choices.isDeleted, false)))
          .orderBy(asc(choices.createdAt))
          .all();
      } catch (error) {
        logger.error(`Error fetching all choices for story ${storyId}:`, error);
        return [];
      }
    },
  };
};
