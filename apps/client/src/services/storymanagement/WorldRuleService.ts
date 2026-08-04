import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import { and, asc, desc, eq, inArray, sql, SQL } from 'drizzle-orm';
import { AppDrizzleClient, WorldRuleInsert, worldRules, WorldRuleSelect } from '../../db';
import { tagRelations } from '../../db/schemas/tagRelations';
import { tags } from '../../db/schemas/tags'; // Import tags schema
import { WorldRuleWithTags } from '../../db/schemas/worldRules'; // Import WorldRuleWithTags from schemas
import { Create, getChangedFields, prepareNewEntityData } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { getUserIdForOperation, recordLocalOperation } from '../../utils/syncUtils';
import { createServerService } from '../ServerService';
import type { FavoriteFilterState } from '../../types/entityFilters';
import { buildCustomAttributeSearchCondition } from '../../utils/attributeSearchPredicate';

export type { FavoriteFilterState };

export interface WorldRuleService {
  getWorldRulesByStoryId(
    storyId: string,
    searchTerm?: string,
    activeFilterTags?: string[],
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: { [key: string]: any },
  ): Promise<WorldRuleWithTags[]>;
  getById(worldRuleId: string): Promise<WorldRuleWithTags | undefined>;
  createWorldRule(currentUserId: string, worldRuleData: Create<WorldRuleInsert>): Promise<WorldRuleSelect>;
  updateWorldRule(currentUserId: string, worldRuleId: string, worldRuleData: Partial<Omit<WorldRuleInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<WorldRuleSelect>;
  deleteWorldRule(currentUserId: string, worldRuleId: string): Promise<void>;
}

export const createWorldRuleService = (db: AppDrizzleClient): WorldRuleService => {
  const serverService = createServerService(db);
  return {
    async getWorldRulesByStoryId(storyId, searchTerm, activeFilterTags, sortBy, sortDirection, favoriteFilterState, advancedSearchCriteria): Promise<WorldRuleWithTags[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(worldRules.storyId, storyId) as SQL<boolean>,
        eq(worldRules.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        conditions.push(sql`${worldRules.title} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>);
      }

      if (activeFilterTags && activeFilterTags.length > 0) {
        // Filter world rules by tags
        const worldRuleIdsWithActiveTags = await db.select({ worldRuleId: tagRelations.relationId })
          .from(tagRelations)
          .where(and(
            eq(tagRelations.storyId, storyId),
            eq(tagRelations.relationType, 'WorldRule'),
            inArray(tagRelations.tagId, activeFilterTags)
          ))
          .execute();
        
        const filteredWorldRuleIds = worldRuleIdsWithActiveTags.map(row => row.worldRuleId);
        
        if (filteredWorldRuleIds.length > 0) {
          conditions.push(inArray(worldRules.id, filteredWorldRuleIds) as SQL<boolean>);
        } else {
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
            } else if (value !== undefined && value !== '') {
              const customCondition = await buildCustomAttributeSearchCondition(db, worldRules.id, key, value);
              if (customCondition) {
                conditions.push(customCondition);
              }
            }
          }
        }
      }

      const finalConditions = conditions.filter(Boolean) as SQL<boolean>[];

      const query = db.select({
        worldRule: worldRules,
        tag: tags,
      })
      .from(worldRules)
      .leftJoin(tagRelations, and(
        eq(tagRelations.relationId, worldRules.id),
        eq(tagRelations.relationType, 'WorldRule'),
        eq(tagRelations.isDeleted, false)
      ))
      .leftJoin(tags, and(
        eq(tags.id, tagRelations.tagId),
        eq(tags.isDeleted, false)
      ))
      .where(and(...finalConditions))
      .$dynamic();

      let resultQuery = query;

      if (sortBy) {
        const orderBy = sortDirection === 'desc' ? desc : asc;
        switch (sortBy) {
          case 'title':
            resultQuery = resultQuery.orderBy(orderBy(worldRules.title));
            break;
          case 'createdAt':
            resultQuery = resultQuery.orderBy(orderBy(worldRules.createdAt));
            break;
          case 'updatedAt':
            resultQuery = resultQuery.orderBy(orderBy(worldRules.updatedAt));
            break;
          default:
            console.warn(`Unknown sortBy field: ${sortBy}`);
            break;
        }
      } else {
        resultQuery = resultQuery.orderBy(asc(worldRules.title));
      }

      const rawResults = await resultQuery.all();

      const worldRulesMap = new Map<string, WorldRuleWithTags>();

      for (const row of rawResults) {
        if (!row.worldRule) continue;

        let worldRule = worldRulesMap.get(row.worldRule.id);
        if (!worldRule) {
          worldRule = { ...row.worldRule, tags: [] };
          worldRulesMap.set(row.worldRule.id, worldRule);
        }

        if (row.tag && row.tag.id) {
          worldRule.tags.push(row.tag);
        }
      }

      return Array.from(worldRulesMap.values());
    },

    async getById(worldRuleId: string): Promise<WorldRuleWithTags | undefined> {
      const rawResults = await db.select({
        worldRule: worldRules,
        tag: tags,
      })
      .from(worldRules)
      .leftJoin(tagRelations, and(
        eq(tagRelations.relationId, worldRules.id),
        eq(tagRelations.relationType, 'WorldRule'),
        eq(tagRelations.isDeleted, false)
      ))
      .leftJoin(tags, and(
        eq(tags.id, tagRelations.tagId),
        eq(tags.isDeleted, false)
      ))
      .where(and(eq(worldRules.id, worldRuleId), eq(worldRules.isDeleted, false)))
      .all();

      if (rawResults.length === 0) {
        return undefined;
      }

      const worldRuleMap = new Map<string, WorldRuleWithTags>();

      for (const row of rawResults) {
        if (!row.worldRule) continue;

        let worldRule = worldRuleMap.get(row.worldRule.id);
        if (!worldRule) {
          worldRule = { ...row.worldRule, tags: [] };
          worldRuleMap.set(row.worldRule.id, worldRule);
        }

        if (row.tag && row.tag.id) {
          worldRule.tags.push(row.tag);
        }
      }

      return worldRuleMap.get(worldRuleId);
    },

    async createWorldRule(currentUserId: string, worldRuleData: Create<WorldRuleInsert>): Promise<WorldRuleSelect> {
      const newWorldRule = prepareNewEntityData<WorldRuleInsert>(worldRuleData);
      const result = await db.insert(worldRules).values(newWorldRule).returning().get();

      const userIdToLog = await getUserIdForOperation(db, serverService, newWorldRule.storyId, currentUserId);
      await recordLocalOperation(db, newWorldRule.storyId, userIdToLog, 'create', 'WorldRule', newWorldRule.id, { ...result });
      entityEventEmitter.emit('worldrule_changed', newWorldRule.storyId, newWorldRule.id);

      return result;
    },

    async updateWorldRule(currentUserId: string, worldRuleId: string, worldRuleData: Partial<Omit<WorldRuleInsert, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<WorldRuleSelect> {
      const originalWorldRule = await db.query.worldRules.findFirst({ where: eq(worldRules.id, worldRuleId) });
      if (!originalWorldRule) {
        throw new Error(`World Rule with ID ${worldRuleId} not found for update.`);
      }

      const potentialNewState = { ...originalWorldRule, ...worldRuleData };

      const changes = getChangedFields(originalWorldRule, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;

      if (Object.keys(changes).length === 0) {
        console.log(`No significant changes detected for world rule ${worldRuleId}. Skipping update and operation log.`);
        return originalWorldRule;
      }

      await db.update(worldRules)
        .set({ ...worldRuleData, updatedAt: new Date(), version: sql`${worldRules.version} + 1` })
        .where(eq(worldRules.id, worldRuleId));

      const updatedWorldRule = await db.query.worldRules.findFirst({ where: eq(worldRules.id, worldRuleId) });
      if (!updatedWorldRule) {
        throw new Error(`Failed to retrieve updated world rule ${worldRuleId}.`);
      }

      const userIdToLog = await getUserIdForOperation(db, serverService, updatedWorldRule.storyId, currentUserId);
      await recordLocalOperation(db, updatedWorldRule.storyId, userIdToLog, 'update', 'WorldRule', worldRuleId, getChangedFields(originalWorldRule, updatedWorldRule));
      entityEventEmitter.emit('worldrule_changed', updatedWorldRule.storyId, updatedWorldRule.id);

      return updatedWorldRule;
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