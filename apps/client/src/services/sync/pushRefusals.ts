import type { SyncConflict as SharedSyncConflict } from '@keres/shared';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { OperationLogSelect } from '../../db/schema';
import { isFoldableDuplicate } from './duplicateFold';

/**
 * The order and the patience with which a push settles the server's refusals.
 *
 * Duplicates fold first: folding rewrites the operations that pointed at the folded row, and a
 * refusal of one of those in the same push judged the old reference. A refusal for a reference the
 * server lacks goes last: whether that reference is still on its way depends on how the others
 * settled.
 */

/** Whether every refusal of an entity is for a reference the server lacks. */
export const onlyMissingReference = (group: readonly SharedSyncConflict[]) =>
  group.every((conflict) => conflict.reason === 'referenced_entity_deleted');

/** Refused entities in the order they settle: duplicates, the rest, missing references. */
export function inSettlingOrder<T extends { group: SharedSyncConflict[] }>(refused: T[]): T[] {
  const rank = (group: SharedSyncConflict[]) =>
    group.some(isFoldableDuplicate) ? 0 : onlyMissingReference(group) ? 2 : 1;
  return [...refused].sort((left, right) => rank(left.group) - rank(right.group));
}

/**
 * Operations refused for a reference the server lacks: waiting themselves, they are no sign that
 * anything is on its way - two of them must not wait on each other forever.
 */
export const waitingOperationIds = (conflicts: readonly SharedSyncConflict[]) =>
  new Set(
    conflicts
      .filter((conflict) => conflict.reason === 'referenced_entity_deleted')
      .flatMap((conflict) => (conflict.clientOperationId ? [conflict.clientOperationId] : [])),
  );

/**
 * Whether a create this push sent - of another entity, and not itself waiting on a reference - is
 * still queued and unsettled: what a refused operation points at may be that one.
 */
export async function createStillOnItsWay(
  db: AppDrizzleClient,
  pushedOperations: readonly OperationLogSelect[],
  entityType: string,
  entityId: string,
  waiting: ReadonlySet<string>,
): Promise<boolean> {
  const creates = pushedOperations.filter(
    (op) =>
      op.operationType === 'create' &&
      !waiting.has(op.id) &&
      !(op.entityType === entityType && op.entityId === entityId),
  );
  if (creates.length === 0) return false;
  const pending = await db
    .select({ id: schema.operationLogs.id })
    .from(schema.operationLogs)
    .where(
      and(
        inArray(
          schema.operationLogs.id,
          creates.map((op) => op.id),
        ),
        eq(schema.operationLogs.isSynced, false),
        isNull(schema.operationLogs.conflictState),
      ),
    )
    .all();
  return pending.length > 0;
}
