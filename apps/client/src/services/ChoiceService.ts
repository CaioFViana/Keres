import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { and, asc, desc, eq, sql, SQL, inArray } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { choices, ChoiceInsert, ChoiceSelect } from '../db/schemas/choices';
import { scenes } from '../db/schemas/scenes';
import { getChangedFields } from '../utils/diffUtils';
import { Create, prepareNewEntityData } from '../utils/entityUtils';
import { entityEventEmitter } from '../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../utils/syncUtils';
import { createServerService } from './ServerService';

export type FavoriteFilterState = 'all'; // Removed favorite/not-favorite

export interface ChoiceService {
  getChoicesByStoryId(
    storyId: string,
    searchTerm?: string,
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: { [key: string]: any },
  ): Promise<ChoiceSelect[]>;
  getById(choiceId: string): Promise<ChoiceSelect | undefined>;
  createChoice(currentUserId: string, choiceData: Create<ChoiceInsert>): Promise<ChoiceSelect>;
  updateChoice(currentUserId: string, choiceId: string, choiceData: Partial<Omit<ChoiceInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<ChoiceSelect>;
  deleteChoice(currentUserId: string, choiceId: string): Promise<void>;
  getAllByStoryId(storyId: string): Promise<ChoiceSelect[]>;
}

export const createChoiceService = (db: AppDrizzleClient): ChoiceService => {
  const serverService = createServerService(db);

  return {
    async getChoicesByStoryId(
      storyId,
      searchTerm,
      sortBy,
      sortDirection,
      favoriteFilterState,
      advancedSearchCriteria
    ): Promise<ChoiceSelect[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(choices.storyId, storyId) as SQL<boolean>,
        eq(choices.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        conditions.push(sql`${choices.text} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>);
      }

      if (advancedSearchCriteria && Object.keys(advancedSearchCriteria).length > 0) {
        const { chapterId, sceneId, ...otherCriteria } = advancedSearchCriteria;

        if (sceneId) {
          conditions.push(eq(choices.sceneId, sceneId) as SQL<boolean>);
        } else if (chapterId) {
          const sceneIdsInChapter = db.select({ id: scenes.id }).from(scenes).where(and(eq(scenes.chapterId, chapterId), eq(scenes.isDeleted, false)));
          conditions.push(inArray(choices.sceneId, sceneIdsInChapter) as SQL<boolean>);
        }

        const choiceMetadata = entityFieldMetadata['Choice'];
        for (const key in otherCriteria) {
          if (Object.prototype.hasOwnProperty.call(otherCriteria, key)) {
            const value = otherCriteria[key];
            const fieldMeta = choiceMetadata.find(meta => meta.name === key);

            if (value !== undefined && value !== '' && fieldMeta) {
              if (fieldMeta.type === 'string') {
                conditions.push(sql`${choices[key as keyof ChoiceSelect]} LIKE ${`%${value}%`} COLLATE NOCASE` as SQL<boolean>);
              } else if (fieldMeta.type === 'number') {
                conditions.push(eq(choices[key as keyof ChoiceSelect], Number(value)) as SQL<boolean>);
              }
            }
          }
        }
      }

      const finalConditions = conditions.filter(c => c !== undefined) as SQL<boolean>[];
      let query = db.select().from(choices).where(and(...finalConditions)).$dynamic();

      if (sortBy) {
        const orderBy = sortDirection === 'desc' ? desc : asc;
        const sortKey = sortBy as keyof ChoiceSelect;
        if (choices[sortKey]) {
          query = query.orderBy(orderBy(choices[sortKey]));
        } else {
          console.warn(`Unknown sortBy field: ${sortBy}`);
        }
      } else {
        query = query.orderBy(asc(choices.createdAt));
      }

      return query.all();
    },

    async getById(choiceId: string): Promise<ChoiceSelect | undefined> {
      return db.query.choices.findFirst({
        where: and(eq(choices.id, choiceId), eq(choices.isDeleted, false)),
      });
    },

    async createChoice(currentUserId: string, choiceData: Create<ChoiceInsert>): Promise<ChoiceSelect> {
      const newChoice = prepareNewEntityData<ChoiceInsert>(choiceData);
      const result = await db.insert(choices).values(newChoice).returning().get();
      const userIdToLog = await getUserIdForOperation(db, serverService, newChoice.storyId, currentUserId);
      await recordLocalOperation(db, newChoice.storyId, userIdToLog, 'create', 'Choice', newChoice.id, { ...result });
      entityEventEmitter.emit('choice_changed', newChoice.storyId, newChoice.id);
      return result;
    },

    async updateChoice(currentUserId: string, choiceId: string, choiceData: Partial<Omit<ChoiceInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<ChoiceSelect> {
      const originalChoice = await db.query.choices.findFirst({ where: eq(choices.id, choiceId) });
      if (!originalChoice) throw new Error(`Choice with ID ${choiceId} not found for update.`);
      const potentialNewState = { ...originalChoice, ...choiceData };
      const changes = getChangedFields(originalChoice, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;
      if (Object.keys(changes).length === 0) return originalChoice;

      await db.update(choices).set({ ...choiceData, updatedAt: new Date(), version: sql`${choices.version} + 1` }).where(eq(choices.id, choiceId));
      const updatedChoice = await db.query.choices.findFirst({ where: eq(choices.id, choiceId) });
      if (!updatedChoice) throw new Error(`Failed to retrieve updated choice ${choiceId}.`);

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedChoice.storyId, currentUserId);
      await recordLocalOperation(db, updatedChoice.storyId, userIdToLog, 'update', 'Choice', choiceId, getChangedFields(originalChoice, updatedChoice));
      entityEventEmitter.emit('choice_changed', updatedChoice.storyId, updatedChoice.id);
      return updatedChoice;
    },

    async deleteChoice(currentUserId: string, choiceId: string): Promise<void> {
      const choiceToDelete = await db.query.choices.findFirst({ where: eq(choices.id, choiceId) });
      if (!choiceToDelete) return;
      const [updatedChoice] = await db.update(choices)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${choices.version} + 1` })
        .where(eq(choices.id, choiceId))
        .returning({ id: choices.id, storyId: choices.storyId, isDeleted: choices.isDeleted, version: choices.version });
      if (!updatedChoice) throw new Error(`Failed to delete choice ${choiceId} or choice not found.`);
      const userIdToLog = await getUserIdForOperation(db, serverService, updatedChoice.storyId, currentUserId);
      await recordLocalOperation(db, updatedChoice.storyId, userIdToLog, 'delete', 'Choice', choiceId, {
        id: updatedChoice.id,
        isDeleted: updatedChoice.isDeleted,
        version: updatedChoice.version,
      });
      entityEventEmitter.emit('choice_changed', updatedChoice.storyId, updatedChoice.id);
    },

    async getAllByStoryId(storyId: string): Promise<ChoiceSelect[]> {
      if (!storyId) return [];
      try {
        return await db.select().from(choices).where(and(eq(choices.storyId, storyId), eq(choices.isDeleted, false))).orderBy(asc(choices.createdAt)).all();
      } catch (error) {
        console.error(`Error fetching all choices for story ${storyId}:`, error);
        return [];
      }
    },
  };
};