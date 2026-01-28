import { desc, eq, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { OperationLogInsert, operationLogs, OperationLogSelect, stories } from '../db/schema'; // Import OperationLogSelect
import { createULID } from '../utils/ulid'; // Import createULID

export type OperationType = 'create' | 'update' | 'delete' | 'reorder';
export type EntityType = string; // e.g., 'Story', 'Character', etc.

export interface OperationLogService {
  getUserIdForOperation(db: AppDrizzleClient, storyId: string, currentUserId: string): Promise<string>;
  recordLocalOperation<T extends object>(
    db: AppDrizzleClient,
    storyId: string,
    userId: string,
    operationType: OperationType,
    entityType: EntityType,
    entityId: string,
    payload: T
  ): Promise<void>;
  getRecentOperationLogs(storyId: string, limit: number): Promise<OperationLogSelect[]>;
  getPaginatedOperationLogs(storyId: string, page: number, pageSize: number): Promise<{ logs: OperationLogSelect[]; total: number }>;
  getOperationLogById(logId: string): Promise<OperationLogSelect | undefined>;
}

export const createOperationLogService = (db: AppDrizzleClient): OperationLogService => {
  return {
    async getUserIdForOperation(db: AppDrizzleClient, storyId: string, currentUserId: string): Promise<string> {
      const story = await db.select().from(stories).where(eq(stories.id, storyId)).get();
      if (!story) {
        // If story doesn't exist, log with current user ID, but this case should ideally not happen
        console.warn(`Story with ID ${storyId} not found when trying to get userId for operation. Using currentUserId.`);
        return currentUserId;
      }
      return story.serverId ? story.userId : currentUserId;
    },

    async recordLocalOperation<T extends object>(
      db: AppDrizzleClient,
      storyId: string,
      userId: string,
      operationType: OperationType,
      entityType: EntityType,
      entityId: string,
      payload: T
    ): Promise<void> {
      console.log(payload)
      const newOperationLog: OperationLogInsert = {
        id: createULID(),
        storyId,
        userId,
        operationVersion: 0, // This will be set by the sync engine later, or incremented locally
        operationType,
        entityType,
        entityId,
        payload: JSON.stringify(payload),
        createdAt: new Date(),
        isSynced: false,
        serverOperationVersion: 0,
      };
      await db.insert(operationLogs).values(newOperationLog).run();
    },

    async getRecentOperationLogs(storyId: string, limit: number): Promise<OperationLogSelect[]> {
      if (!storyId) {
        console.warn('getRecentOperationLogs: storyId is required.');
        return [];
      }
      return db.query.operationLogs.findMany({
        where: eq(operationLogs.storyId, storyId),
        orderBy: desc(operationLogs.createdAt),
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
        orderBy: desc(operationLogs.createdAt),
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
