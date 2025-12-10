import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { OperationLogInsert, operationLogs, stories } from '../db/schema';
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
}

export const createOperationLogService = (): OperationLogService => {
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
  };
};
