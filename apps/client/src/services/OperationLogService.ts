import { desc, eq, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { operationLogs, OperationLogSelect } from '../db/schema'; // Import OperationLogSelect

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
  getRecentOperationLogs(storyId: string, limit: number): Promise<OperationLogSelect[]>;
  getPaginatedOperationLogs(storyId: string, page: number, pageSize: number): Promise<{ logs: OperationLogSelect[]; total: number }>;
  getOperationLogById(logId: string): Promise<OperationLogSelect | undefined>;
}

export const createOperationLogService = (db: AppDrizzleClient): OperationLogService => {
  return {
    async getRecentOperationLogs(storyId: string, limit: number): Promise<OperationLogSelect[]> {
      if (!storyId) {
        console.warn('getRecentOperationLogs: storyId is required.');
        return [];
      }
      // Batched operations (e.g. a multi-entity save) share the same millisecond in
      // createdAt, so `rowid` (monotonic insertion order) breaks the tie deterministically.
      return db.query.operationLogs.findMany({
        where: eq(operationLogs.storyId, storyId),
        orderBy: [desc(operationLogs.createdAt), desc(sql`rowid`)],
        limit: limit,
      });
    },

    async getPaginatedOperationLogs(storyId: string, page: number, pageSize: number): Promise<{ logs: OperationLogSelect[]; total: number }> {
      if (!storyId) {
        console.warn('getPaginatedOperationLogs: storyId is required.');
        return { logs: [], total: 0 };
      }

      const offset = (page - 1) * pageSize;

      const logs = await db.query.operationLogs.findMany({
        where: eq(operationLogs.storyId, storyId),
        orderBy: [desc(operationLogs.createdAt), desc(sql`rowid`)],
        limit: pageSize,
        offset: offset,
      });

      const totalResult = await db.select({ count: sql<number>`count(*)` })
        .from(operationLogs)
        .where(eq(operationLogs.storyId, storyId))
        .get();

      const total = totalResult?.count || 0;

      return { logs, total };
    },

    async getOperationLogById(logId: string): Promise<OperationLogSelect | undefined> {
      if (!logId) {
        console.warn('getOperationLogById: logId is required.');
        return undefined;
      }
      return db.query.operationLogs.findFirst({
        where: eq(operationLogs.id, logId),
      });
    },
  };
};
