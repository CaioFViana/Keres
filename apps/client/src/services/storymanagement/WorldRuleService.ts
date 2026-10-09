import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AppDrizzleClient, WorldRuleInsert, WorldRuleSelect } from '../../db';
import { worldRules } from '../../db';
import { tagRelations } from '../../db/schemas/tagRelations';
import { tags } from '../../db/schemas/tags'; // Import tags schema
import type { WorldRuleWithTags } from '../../db/schemas/worldRules'; // Import WorldRuleWithTags from schemas
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

export interface WorldRuleService {
  getWorldRulesByStoryId(
    storyId: string,
    searchTerm?: string,
    activeFilterTags?: string[],
    sortBy?: string | null,
    sortDirection?: 'asc' | 'desc',
    favoriteFilterState?: FavoriteFilterState,
    advancedSearchCriteria?: AdvancedSearchCriteria,
  ): Promise<WorldRuleWithTags[]>;
  getWorldRuleCount(storyId?: string): Promise<number>;
  getById(worldRuleId: string): Promise<WorldRuleWithTags | undefined>;
  createWorldRule(
    currentUserId: string,
    worldRuleData: Create<WorldRuleInsert>,
  ): Promise<WorldRuleSelect>;
  updateWorldRule(
    currentUserId: string,
    worldRuleId: string,
    worldRuleData: Partial<
      Omit<
        WorldRuleInsert,
        'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
      >
    >,
  ): Promise<WorldRuleSelect>;
  deleteWorldRule(currentUserId: string, worldRuleId: string): Promise<void>;
}

export const createWorldRuleService = (db: AppDrizzleClient): WorldRuleService => {
  const serverService = createServerService(db);
  return {
    async getWorldRuleCount(storyId?: string): Promise<number> {
      return countActiveStoryEntities(db, worldRules, storyId);
    },

    async getWorldRulesByStoryId(
      storyId,
      searchTerm,
      activeFilterTags,
      sortBy,
      sortDirection,
      favoriteFilterState,
      advancedSearchCriteria,
    ): Promise<WorldRuleWithTags[]> {
      const conditions: (SQL<boolean> | undefined)[] = [
        eq(worldRules.storyId, storyId) as SQL<boolean>,
        eq(worldRules.isDeleted, false) as SQL<boolean>,
      ];

      if (searchTerm) {
        conditions.push(
          sql`${worldRules.title} LIKE ${`%${searchTerm}%`} COLLATE NOCASE` as SQL<boolean>,
        );
      }

      if (activeFilterTags && activeFilterTags.length > 0) {
        // Filter world rules by tags
        const worldRuleIdsWithActiveTags = await db
          .select({ worldRuleId: tagRelations.relationId })
          .from(tagRelations)
          .where(
            and(
              eq(tagRelations.storyId, storyId),
              eq(tagRelations.relationType, 'WorldRule'),
              inArray(tagRelations.tagId, activeFilterTags),
            ),
          )
          .execute();

        const filteredWorldRuleIds = worldRuleIdsWithActiveTags.map((row) => row.worldRuleId);

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

      conditions.push(
        ...(await buildAdvancedSearchConditions(
          'WorldRule',
          worldRules,
          advancedSearchCriteria,
          (field, value) => buildCustomAttributeSearchCondition(db, worldRules.id, field, value),
        )),
      );

      const finalConditions = conditions.filter(Boolean) as SQL<boolean>[];

      const query = db
        .select({
          worldRule: worldRules,
          tag: tags,
        })
        .from(worldRules)
        .leftJoin(
          tagRelations,
          and(
            eq(tagRelations.relationId, worldRules.id),
            eq(tagRelations.relationType, 'WorldRule'),
            eq(tagRelations.isDeleted, false),
          ),
        )
        .leftJoin(tags, and(eq(tags.id, tagRelations.tagId), eq(tags.isDeleted, false)))
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
      const rawResults = await db
        .select({
          worldRule: worldRules,
          tag: tags,
        })
        .from(worldRules)
        .leftJoin(
          tagRelations,
          and(
            eq(tagRelations.relationId, worldRules.id),
            eq(tagRelations.relationType, 'WorldRule'),
            eq(tagRelations.isDeleted, false),
          ),
        )
        .leftJoin(tags, and(eq(tags.id, tagRelations.tagId), eq(tags.isDeleted, false)))
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

      return decorateFavorite(db, 'WorldRule', worldRuleMap.get(worldRuleId));
    },

    async createWorldRule(
      currentUserId: string,
      worldRuleData: Create<WorldRuleInsert>,
    ): Promise<WorldRuleSelect> {
      await assertStoryIsWritable(db, worldRuleData.storyId);
      let newWorldRule = prepareNewEntityData<WorldRuleInsert>(worldRuleData);
      const favorite = await normalizeFavoriteCreate(
        db,
        newWorldRule.storyId,
        'WorldRule',
        newWorldRule,
      );
      newWorldRule = favorite.data;
      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        newWorldRule.storyId,
        currentUserId,
      );
      const result = await runLocalWrite(db, newWorldRule.storyId, () => {
        const inserted = db.insert(worldRules).values(newWorldRule).returning().get();
        recordLocalOperationSync(
          db,
          newWorldRule.storyId,
          userIdToLog,
          'create',
          'WorldRule',
          newWorldRule.id,
          { ...inserted },
        );
        return inserted;
      });
      // After the create, so its operation is never pushed ahead of the entity it points at.
      await persistInitialFavorite(
        db,
        newWorldRule.storyId,
        newWorldRule.id,
        'WorldRule',
        currentUserId,
        favorite.individualFavorite,
      );
      entityEventEmitter.emit('worldrule_changed', newWorldRule.storyId, newWorldRule.id);

      return result;
    },

    async updateWorldRule(
      currentUserId: string,
      worldRuleId: string,
      worldRuleData: Partial<
        Omit<
          WorldRuleInsert,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        >
      >,
    ): Promise<WorldRuleSelect> {
      const originalWorldRule = await db.query.worldRules.findFirst({
        where: eq(worldRules.id, worldRuleId),
      });
      if (!originalWorldRule) {
        throw new Error(`World Rule with ID ${worldRuleId} not found for update.`);
      }
      await assertStoryIsWritable(db, originalWorldRule.storyId);
      worldRuleData = await normalizeFavoriteUpdate(
        db,
        originalWorldRule.storyId,
        worldRuleId,
        'WorldRule',
        currentUserId,
        worldRuleData,
      );

      const potentialNewState = { ...originalWorldRule, ...worldRuleData };

      const changes = getChangedFields(originalWorldRule, potentialNewState);
      delete changes.version;
      delete changes.updatedAt;

      if (Object.keys(changes).length === 0) {
        console.log(
          `No significant changes detected for world rule ${worldRuleId}. Skipping update and operation log.`,
        );
        return originalWorldRule;
      }

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        originalWorldRule.storyId,
        currentUserId,
      );
      const updatedWorldRule = await runLocalWrite(db, originalWorldRule.storyId, () => {
        db.update(worldRules)
          .set({ ...worldRuleData, updatedAt: new Date(), version: sql`${worldRules.version} + 1` })
          .where(eq(worldRules.id, worldRuleId))
          .run();
        const updated = db.select().from(worldRules).where(eq(worldRules.id, worldRuleId)).get();
        if (!updated) {
          throw new Error(`Failed to retrieve updated world rule ${worldRuleId}.`);
        }
        recordLocalOperationSync(
          db,
          updated.storyId,
          userIdToLog,
          'update',
          'WorldRule',
          worldRuleId,
          getChangedFields(originalWorldRule, updated),
        );
        return updated;
      });
      entityEventEmitter.emit('worldrule_changed', updatedWorldRule.storyId, updatedWorldRule.id);

      return updatedWorldRule;
    },

    async deleteWorldRule(currentUserId: string, worldRuleId: string): Promise<void> {
      const worldRuleToDelete = await db.query.worldRules.findFirst({
        where: eq(worldRules.id, worldRuleId),
      });
      if (!worldRuleToDelete) {
        console.warn(`Attempted to delete non-existent world rule ${worldRuleId}.`);
        return;
      }
      await assertStoryIsWritable(db, worldRuleToDelete.storyId);

      const userIdToLog = await getUserIdForOperation(
        db,
        serverService,
        worldRuleToDelete.storyId,
        currentUserId,
      );
      const updatedWorldRule = await runLocalWrite(db, worldRuleToDelete.storyId, () => {
        const deleted = softDeleteRowSync(db, worldRules, 'WorldRule', worldRuleId, userIdToLog);
        return deleted;
      });
      entityEventEmitter.emit('worldrule_changed', updatedWorldRule.storyId, updatedWorldRule.id);
    },
  };
};
