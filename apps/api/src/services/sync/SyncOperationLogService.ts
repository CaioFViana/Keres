import type {
  ChapterReorderingStoryUpdate,
  StoryReorderingStoryUpdate,
  StoryUpdate,
} from '@keres/shared';
import { eq, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../../db';
import { operationLog, operationTypeEnum, stories } from '../../db/schema';
import type { SyncEntityHandler } from '../entity-sync-handlers/BaseSyncEntityHandler';

/**
 * API persistence for sync operation history. It atomically advances the story-local operation
 * counter and writes the corresponding log row. Kept independent from the push coordinator so
 * administrative recovery can record a mutation through exactly the same ordering mechanism.
 */
export class SyncOperationLogService {
  constructor(private readonly entityHandlers: ReadonlyMap<string, SyncEntityHandler>) {}

  async append(args: {
    storyId: string;
    userId: string;
    update: StoryUpdate;
    entityId: string;
    entityVersion?: number;
  }): Promise<{ id: string; operationVersion: number }> {
    const { storyId, userId, update, entityId, entityVersion } = args;
    const handler = this.entityHandlers.get(update.entity);
    let payload: Record<string, any> = {};
    if (handler) {
      payload = handler.sanitizePayloadForLog(update, userId);
    } else if (update.type === 'delete') {
      payload = { id: entityId };
    } else if (update.type === 'reorder') {
      payload = {
        reorderItems: (update as ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate)
          .reorderItems,
        reorderTarget: (update as StoryReorderingStoryUpdate).reorderTarget,
        schemaEntityType: (update as StoryReorderingStoryUpdate).schemaEntityType,
      };
    }

    const [{ nextOperationVersion } = { nextOperationVersion: undefined }] = await db
      .update(stories)
      .set({ lastOperationVersion: sql`${stories.lastOperationVersion} + 1` })
      .where(eq(stories.id, storyId))
      .returning({ nextOperationVersion: stories.lastOperationVersion });
    if (nextOperationVersion === undefined) {
      throw new Error(`SyncService: story ${storyId} not found while appending an operation log.`);
    }

    const id = ulid();
    await db.insert(operationLog).values({
      id,
      storyId,
      userId,
      operationVersion: nextOperationVersion,
      operationType: operationTypeEnum.enumValues.includes(update.type as any)
        ? (update.type as any)
        : 'update',
      entityType: update.entity,
      entityId: entityId || ulid(),
      payload,
      entityVersion: entityVersion ?? null,
      createdAt: update.operationTime ? new Date(update.operationTime) : new Date(),
    });
    return { id, operationVersion: nextOperationVersion };
  }
}
