import type { StoryUpdate, SyncAppliedOperation } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { operationLog } from '../../db/schema';
import type { SyncEntityHandler } from '../entity-sync-handlers/BaseSyncEntityHandler';

/**
 * The idempotent acknowledgement for an already-recorded client operation, or null when this
 * key was never logged. A hit reports the ORIGINAL operation version from the recorded row -
 * never the current max - while the entity version is refreshed from the live row when there
 * is one, exactly as the already-applied paths report it. The lookup runs outside any
 * transaction: the recorded row is immutable.
 */
export async function findIdempotentHit(
  storyId: string,
  update: StoryUpdate,
  entityId: string,
  entityHandlers: ReadonlyMap<string, SyncEntityHandler>,
): Promise<SyncAppliedOperation | null> {
  const [recorded] = await db
    .select({
      operationVersion: operationLog.operationVersion,
      entityVersion: operationLog.entityVersion,
      entityType: operationLog.entityType,
      entityId: operationLog.entityId,
    })
    .from(operationLog)
    .where(
      and(
        eq(operationLog.storyId, storyId),
        eq(operationLog.clientOperationId, update.clientOperationId!),
      ),
    )
    .limit(1);
  if (!recorded) return null;
  let entityVersion = recorded.entityVersion ?? undefined;
  // The live version is read from the entity the RECORDED row names, never from the incoming
  // envelope: a resend pairing one of the caller's own keys with a foreign entity id would
  // otherwise read that entity's version out of any story.
  const hitHandler = entityHandlers.get(recorded.entityType);
  if (hitHandler && recorded.entityId) {
    const live = await hitHandler.findById(recorded.entityId).catch(() => undefined);
    if (typeof live?.version === 'number') entityVersion = live.version;
  }
  return {
    clientOperationId: update.clientOperationId,
    operationVersion: recorded.operationVersion,
    entityVersion,
    entity: update.entity,
    entityId,
  };
}
