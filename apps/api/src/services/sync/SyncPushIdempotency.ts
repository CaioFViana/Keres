import type {
  ChapterReorderingStoryUpdate,
  StoryReorderingStoryUpdate,
  StoryUpdate,
  SyncAppliedOperation,
} from '@keres/shared';
import { sameReorderArrangement } from '@keres/shared';
import { and, asc, eq, gt } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
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
  const hitHandler = entityHandlers.get(update.entity);
  if (hitHandler && entityId) {
    const live = await hitHandler.findById(entityId).catch(() => undefined);
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

/**
 * Whether a logged reorder row disputes the same row set as the incoming op. Chapters reorder
 * scenes only; a Story reorder is scoped by its target (absent means chapters), and a
 * schema-field order additionally by its entity type. Anything unrecognised fails closed.
 */
function reorderTwinTargetMatches(
  entity: string,
  logged: { reorderTarget?: unknown; schemaEntityType?: unknown },
  incoming: { reorderTarget?: unknown; schemaEntityType?: unknown },
): boolean {
  if (entity !== 'Story') return true;
  const loggedTarget = logged.reorderTarget ?? undefined;
  const incomingTarget = incoming.reorderTarget ?? undefined;
  if (loggedTarget !== incomingTarget) return false;
  if (incomingTarget === 'StorySchemaField') {
    return (
      typeof logged.schemaEntityType === 'string' &&
      logged.schemaEntityType === incoming.schemaEntityType
    );
  }
  return true;
}

/**
 * A logged reorder already carrying this op's exact arrangement, oldest first. Only rows
 * applied *past* the op's base qualify: an older twin means the world moved on since, and
 * the op is genuinely divergent. Rows without an entity version predate that column and
 * cannot prove anything, so the comparison excludes them.
 *
 * Oldest, not newest: the client keys its echo check on the returned version, absorbing
 * that one operation and applying everything else. With X-Y-X in history, pointing the
 * retry at the newest X would absorb it while applying the older X and the Y in between,
 * leaving the client on Y while the server holds X. The oldest twin is the op's own
 * original (or an equivalent one already pulled), so every later twin still applies in
 * order and both sides land on the same arrangement.
 */
export async function findAppliedReorderTwin(
  tx: CompatibleDb,
  storyId: string,
  update: StoryUpdate,
  entityId: string,
  baseVersion: number,
): Promise<{ operationVersion: number } | undefined> {
  const reorder = update as ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate;
  if (!Array.isArray(reorder.reorderItems) || reorder.reorderItems.length === 0) {
    return undefined;
  }
  const rows = await tx
    .select({
      operationVersion: operationLog.operationVersion,
      entityVersion: operationLog.entityVersion,
      payload: operationLog.payload,
    })
    .from(operationLog)
    .where(
      and(
        eq(operationLog.storyId, storyId),
        eq(operationLog.entityType, update.entity),
        eq(operationLog.entityId, entityId),
        eq(operationLog.operationType, 'reorder'),
        gt(operationLog.entityVersion, baseVersion),
      ),
    )
    .orderBy(asc(operationLog.operationVersion));
  for (const row of rows) {
    const payload = (row.payload ?? {}) as {
      reorderItems?: unknown;
      reorderTarget?: unknown;
      schemaEntityType?: unknown;
    };
    const incomingTarget = reorder as {
      reorderTarget?: unknown;
      schemaEntityType?: unknown;
    };
    if (!reorderTwinTargetMatches(update.entity, payload, incomingTarget)) continue;
    if (
      Array.isArray(payload.reorderItems) &&
      sameReorderArrangement(payload.reorderItems, reorder.reorderItems)
    ) {
      return { operationVersion: row.operationVersion };
    }
  }
  return undefined;
}
