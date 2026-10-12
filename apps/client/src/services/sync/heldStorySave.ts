import type { SyncConflict as SharedSyncConflict } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { PushOutcomeReport } from './SyncPush';

/**
 * What a save of the story's own record reports when the server did not get it because the save waits in a pending
 * conflict. A local edit of an entity that has an open conflict joins that conflict instead of being pushed (see
 * `findConflictHoldingEdits` in `utils/syncUtils.ts`), so the cycle sends nothing and the push reports nothing. Without
 * this the save would show success over a change the server never received, and the refusal that caused the conflict
 * would never be named again.
 *
 * Only the story record is asked about: every manual save of the story settings and the story form changes that row.
 * A quarantine (a change that can never be sent, with no server snapshot) holds nothing new, so it is not reported.
 */
export async function heldStorySaveReport(
  db: AppDrizzleClient,
  storyId: string,
): Promise<PushOutcomeReport> {
  const pending = await db.query.syncConflicts.findMany({
    where: and(
      eq(schema.syncConflicts.storyId, storyId),
      eq(schema.syncConflicts.entityType, 'Story'),
      eq(schema.syncConflicts.entityId, storyId),
      eq(schema.syncConflicts.status, 'pending'),
    ),
  });
  const refusals: SharedSyncConflict[] = pending
    .filter((conflict) => !(conflict.reason === 'validation' && !conflict.serverValues))
    .map((conflict) => ({
      entity: conflict.entityType,
      entityId: conflict.entityId,
      type: conflict.localOperationType,
      reason: conflict.reason as SharedSyncConflict['reason'],
      message: conflict.message ?? conflict.reason,
    }));
  return { conflicts: refusals.length, refusals };
}
