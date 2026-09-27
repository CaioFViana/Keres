import type { StoryUpdate } from '@keres/shared';
import { eq, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, type CompatibleDb } from '../../db';
import { operationLog, operationTypeEnum, stories } from '../../db/schema';
import type { SyncEntityHandler } from '../entity-sync-handlers/BaseSyncEntityHandler';

/**
 * API persistence for sync operation history. It atomically advances the story-local operation
 * counter and writes the corresponding log row. Kept independent from the push coordinator so
 * administrative recovery can record a mutation through exactly the same ordering mechanism.
 */
export class SyncOperationLogService {
  constructor(private readonly entityHandlers: ReadonlyMap<string, SyncEntityHandler>) {}

  async append(
    args: {
      storyId: string;
      userId: string;
      update: StoryUpdate;
      entityId: string;
      entityVersion?: number;
      /** Replaces the handler's sanitised payload (a restore records the whole restored row). */
      payload?: Record<string, unknown>;
    },
    database: CompatibleDb = db,
  ): Promise<{ id: string; operationVersion: number }> {
    const { storyId, userId, update, entityId, entityVersion } = args;
    if (!entityId) {
      // A log row with an invented entity id would never match an echo or twin check downstream;
      // refuse instead of recording an operation nobody can correlate.
      throw new Error('SyncService: cannot append an operation log without an entity id.');
    }
    const handler = this.entityHandlers.get(update.entity);
    // The log row must carry enough to rebuild the operation on pull even when no handler is
    // registered for the entity: a delete needs only its id.
    // With a handler, the payload is what was written, never the client's raw JSON.
    let payload: Record<string, unknown> = {};
    if (args.payload) {
      payload = args.payload;
    } else if (handler) {
      payload = handler.sanitizePayloadForLog(update, userId);
    } else if (update.type === 'delete') {
      payload = { id: entityId };
    }

    const [{ nextOperationVersion } = { nextOperationVersion: undefined }] = await database
      .update(stories)
      .set({ lastOperationVersion: sql`${stories.lastOperationVersion} + 1` })
      .where(eq(stories.id, storyId))
      .returning({ nextOperationVersion: stories.lastOperationVersion });
    if (nextOperationVersion === undefined) {
      throw new Error(`SyncService: story ${storyId} not found while appending an operation log.`);
    }

    const id = ulid();
    await database.insert(operationLog).values({
      id,
      storyId,
      userId,
      operationVersion: nextOperationVersion,
      operationType: (operationTypeEnum.enumValues as readonly string[]).includes(update.type)
        ? (update.type as (typeof operationTypeEnum.enumValues)[number])
        : 'update',
      entityType: update.entity,
      entityId,
      payload,
      entityVersion: entityVersion ?? null,
      clientOperationId: update.clientOperationId || null,
      createdAt: update.operationTime ? new Date(update.operationTime) : new Date(),
    });
    return { id, operationVersion: nextOperationVersion };
  }
}
