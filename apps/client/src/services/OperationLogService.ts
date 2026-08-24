import type { FavoriteBehavior } from '@keres/shared';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import type { OperationLogSelect } from '../db/schema';
import { operationLogs } from '../db/schema'; // Import OperationLogSelect
import { createFavoriteService } from './storymanagement/FavoriteService';

export type OperationType = 'create' | 'update' | 'delete' | 'reorder';
export type EntityType = string; // e.g., 'Story', 'Character', etc.

/**
 * Read-only queries over the operation log, for the List/Detail screens. Recording an
 * operation is `utils/syncUtils.ts`'s `recordLocalOperation`/`getUserIdForOperation` - every
 * entity service uses those (they correctly sequence `operationVersion` against
 * `stories.lastOperationLog`). This file used to have its own second, divergent copy of both
 * (hardcoded `operationVersion: 0`, never advanced `lastOperationLog`, different
 * `getUserIdForOperation` semantics) that only `StoryService` called - removed once
 * `StoryService` was switched to the shared implementation, so the two could never drift
 * apart again.
 */
export interface OperationLogService {
  getRecentOperationLogs(
    storyId: string,
    limit: number,
    localUserId?: string,
  ): Promise<OperationLogSelect[]>;
  getPaginatedOperationLogs(
    storyId: string,
    page: number,
    pageSize: number,
    localUserId?: string,
  ): Promise<{ logs: OperationLogSelect[]; total: number }>;
  getOperationLogById(logId: string, localUserId?: string): Promise<OperationLogSelect | undefined>;
  getFavoriteBehavior(storyId: string): Promise<FavoriteBehavior>;
}

export const createOperationLogService = (db: AppDrizzleClient): OperationLogService => {
  const favoriteService = createFavoriteService(db);

  const visibleLogsWhere = async (storyId: string, localUserId?: string) => {
    const behavior = await favoriteService.getBehavior(storyId);
    const storyWhere = eq(operationLogs.storyId, storyId);
    if (behavior !== 'individual') return storyWhere;

    const viewerId = localUserId
      ? await favoriteService.resolveUserId(storyId, localUserId)
      : undefined;
    return viewerId
      ? and(
          storyWhere,
          or(ne(operationLogs.entityType, 'Favorite'), eq(operationLogs.userId, viewerId)),
        )
      : and(storyWhere, ne(operationLogs.entityType, 'Favorite'));
  };

  return {
    async getRecentOperationLogs(
      storyId: string,
      limit: number,
      localUserId?: string,
    ): Promise<OperationLogSelect[]> {
      if (!storyId) {
        console.warn('getRecentOperationLogs: storyId is required.');
        return [];
      }
      // Batched operations (e.g. a multi-entity save) share the same millisecond in
      // createdAt, so `rowid` (monotonic insertion order) breaks the tie deterministically.
      return db.query.operationLogs.findMany({
        where: await visibleLogsWhere(storyId, localUserId),
        orderBy: [desc(operationLogs.createdAt), desc(sql`rowid`)],
        limit: limit,
      });
    },

    async getPaginatedOperationLogs(
      storyId: string,
      page: number,
      pageSize: number,
      localUserId?: string,
    ): Promise<{ logs: OperationLogSelect[]; total: number }> {
      if (!storyId) {
        console.warn('getPaginatedOperationLogs: storyId is required.');
        return { logs: [], total: 0 };
      }

      const offset = (page - 1) * pageSize;

      const where = await visibleLogsWhere(storyId, localUserId);
      const logs = await db.query.operationLogs.findMany({
        where,
        orderBy: [desc(operationLogs.createdAt), desc(sql`rowid`)],
        limit: pageSize,
        offset: offset,
      });

      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(operationLogs)
        .where(where)
        .get();

      const total = totalResult?.count || 0;

      return { logs, total };
    },

    async getOperationLogById(
      logId: string,
      localUserId?: string,
    ): Promise<OperationLogSelect | undefined> {
      if (!logId) {
        console.warn('getOperationLogById: logId is required.');
        return undefined;
      }
      const log = await db.query.operationLogs.findFirst({
        where: eq(operationLogs.id, logId),
      });
      if (!log || log.entityType !== 'Favorite') return log;
      const behavior = await favoriteService.getBehavior(log.storyId);
      if (behavior !== 'individual') return log;
      if (!localUserId) return undefined;
      const viewerId = await favoriteService.resolveUserId(log.storyId, localUserId);
      return log.userId === viewerId ? log : undefined;
    },

    getFavoriteBehavior(storyId: string): Promise<FavoriteBehavior> {
      return favoriteService.getBehavior(storyId);
    },
  };
};
