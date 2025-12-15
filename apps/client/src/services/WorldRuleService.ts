import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { and, asc, desc, eq, inArray, sql, SQL } from 'drizzle-orm';
import { AppDrizzleClient, WorldRuleInsert, worldRules, WorldRuleSelect } from '../db';
import { tagRelations } from '../db/schemas/tagRelations';
import { Create, prepareNewEntityData } from '../utils/entityUtils';
import { entityEventEmitter } from '../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../utils/syncUtils';
import { createServerService } from './ServerService';

export type FavoriteFilterState = 'all' | 'favorite' | 'not-favorite';

export interface WorldRuleService {
  getWorldRulesByStoryId(
    storyId: string,
    searchTerm?: string,
    activeFilterTags?: string[],
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: { [key: string]: any },
  ): Promise<WorldRuleSelect[]>;
  getById(worldRuleId: string): Promise<WorldRuleSelect | undefined>;
  createWorldRule(currentUserId: string, worldRuleData: Create<WorldRuleInsert>): Promise<WorldRuleSelect>;
  updateWorldRule(currentUserId: string, worldRuleId: string, worldRuleData: Partial<Omit<WorldRuleInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void>;
  deleteWorldRule(currentUserId: string, worldRuleId: string): Promise<void>;
}

export const createWorldRuleService = (db: AppDrizzleClient): WorldRuleService => {
  const serverService = createServerService(db);
  return {
    async getWorldRulesByStoryId(storyId, searchTerm, activeFilterTags, sortBy, sortDirection, favoriteFilterState, advancedSearchCriteria): Promise<WorldRuleSelect[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(worldRules.storyId, storyId) as SQL<boolean>,
        eq(worldRules.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        conditions.push(sql`${worldRules.title} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>);
      }

      if (activeFilterTags && activeFilterTags.length > 0) {
        // Join with tagRelations to filter by tags
        const worldRuleIdsWithActiveTags = await db.select({ worldRuleId: tagRelations.entityId })
          .from(tagRelations)
          .where(and(
            eq(tagRelations.storyId, storyId),
            eq(tagRelations.entityType, 'WorldRule'), // Assuming 'WorldRule' as the relationType
            inArray(tagRelations.tagId, activeFilterTags)
          ))
          .execute();
        
        const filteredWorldRuleIds = worldRuleIdsWithActiveTags.map(row => row.worldRuleId);
        
        if (filteredWorldRuleIds.length > 0) {
          conditions.push(inArray(worldRules.id, filteredWorldRuleIds) as SQL<boolean>);
        } else {
          // If no world rules match the selected tags, return an empty array early
          return [];
        }
      }

      if (favoriteFilterState === 'favorite') {
        conditions.push(eq(worldRules.isFavorite, true) as SQL<boolean>);
      } else if (favoriteFilterState === 'not-favorite') {
        conditions.push(eq(worldRules.isFavorite, false) as SQL<boolean>);
      }

      // Apply advanced search criteria
      if (advancedSearchCriteria && Object.keys(advancedSearchCriteria).length > 0) {
        // Assuming entityFieldMetadata for 'WorldRule' exists
        const worldRuleMetadata = entityFieldMetadata['WorldRule'];
        for (const key in advancedSearchCriteria) {
          if (Object.prototype.hasOwnProperty.call(advancedSearchCriteria, key)) {
            const value = advancedSearchCriteria[key];
            const fieldMeta = worldRuleMetadata.find(meta => meta.name === key);

            if (value !== undefined && value !== '' && fieldMeta) {
              if (fieldMeta.type === 'string') {
                conditions.push(sql`${worldRules[key as keyof WorldRuleSelect]} LIKE ${`%${value}%`} COLLATE NOCASE` as SQL<boolean>);
              } else if (fieldMeta.type === 'boolean') {
                conditions.push(eq(worldRules[key as keyof WorldRuleSelect], value) as SQL<boolean>);
              }
              // Add other types (number, date, etc.) as needed
            }
          }
        }
      }

      const finalConditions = conditions.filter(Boolean) as SQL<boolean>[];

      let query = db.select().from(worldRules).where(and(...finalConditions)).$dynamic();

      if (sortBy) {
        const orderBy = sortDirection === 'desc' ? desc : asc;
        switch (sortBy) {
          case 'title':
            query = query.orderBy(orderBy(worldRules.title));
            break;
          case 'createdAt':
            query = query.orderBy(orderBy(worldRules.createdAt));
            break;
          case 'updatedAt':
            query = query.orderBy(orderBy(worldRules.updatedAt));
            break;
          default:
            console.warn(`Unknown sortBy field: ${sortBy}`);
            break;
        }
      } else {
        query = query.orderBy(asc(worldRules.title));
      }

      const result = await query.all();
      return result;
    },

    async getById(worldRuleId: string): Promise<WorldRuleSelect | undefined> {
      return db.query.worldRules.findFirst({
        where: and(eq(worldRules.id, worldRuleId), eq(worldRules.isDeleted, false)),
      });
    },

    async createWorldRule(currentUserId: string, worldRuleData: Create<WorldRuleInsert>): Promise<WorldRuleSelect> {
      const newWorldRule = prepareNewEntityData<WorldRuleInsert>(worldRuleData);
      const result = await db.insert(worldRules).values(newWorldRule).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newWorldRule.storyId, currentUserId);
      await recordLocalOperation(db, newWorldRule.storyId, userIdToLog, 'create', 'WorldRule', newWorldRule.id, { ...result });
      entityEventEmitter.emit('worldrule_changed', newWorldRule.storyId, newWorldRule.id);

      return result;
    },

    async updateWorldRule(currentUserId: string, worldRuleId: string, worldRuleData: Partial<Omit<WorldRuleInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void> {
      const [updatedWorldRule] = await db.update(worldRules)
        .set({ ...worldRuleData, updatedAt: new Date(), version: sql`${worldRules.version} + 1` })
        .where(eq(worldRules.id, worldRuleId))
        .returning({ id: worldRules.id, storyId: worldRules.storyId, version: worldRules.version });

      if (!updatedWorldRule) {
        throw new Error(`Failed to update world rule ${worldRuleId} or world rule not found.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedWorldRule.storyId, currentUserId);
      await recordLocalOperation(db, updatedWorldRule.storyId, userIdToLog, 'update', 'WorldRule', worldRuleId, {
        ...worldRuleData,
        version: updatedWorldRule.version,
      });
      entityEventEmitter.emit('worldrule_changed', updatedWorldRule.storyId, updatedWorldRule.id);
    },

    async deleteWorldRule(currentUserId: string, worldRuleId: string): Promise<void> {
      const worldRuleToDelete = await db.query.worldRules.findFirst({ where: eq(worldRules.id, worldRuleId) });
      if (!worldRuleToDelete) {
        console.warn(`Attempted to delete non-existent world rule ${worldRuleId}.`);
        return;
      }

      const [updatedWorldRule] = await db.update(worldRules)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date(), version: sql`${worldRules.version} + 1` })
        .where(eq(worldRules.id, worldRuleId))
        .returning({ id: worldRules.id, storyId: worldRules.storyId, isDeleted: worldRules.isDeleted, version: worldRules.version });

      if (!updatedWorldRule) {
        throw new Error(`Failed to delete world rule ${worldRuleId} or world rule not found.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedWorldRule.storyId, currentUserId);
      await recordLocalOperation(db, updatedWorldRule.storyId, userIdToLog, 'delete', 'WorldRule', worldRuleId, {
        id: updatedWorldRule.id,
        isDeleted: updatedWorldRule.isDeleted,
        version: updatedWorldRule.version,
      });
      entityEventEmitter.emit('worldrule_changed', updatedWorldRule.storyId, updatedWorldRule.id);
    },
  };
};