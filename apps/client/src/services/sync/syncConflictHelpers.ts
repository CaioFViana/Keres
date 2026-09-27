import { ARRANGED } from '@keres/shared';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import { and, eq, isNull, lt, or } from 'drizzle-orm';

/**
 * Helpers of `SyncConflictService` and the pull/push that need no conflict-service state: the
 * server-snapshot fold and the bookkeeping of conflicts as the server moves on.
 */

export function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Row bookkeeping, never carried as a local edit when accepting the server's state. */
export const SNAPSHOT_BOOKKEEPING = new Set([
  'id',
  'storyId',
  'version',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'isDeleted',
]);

/**
 * The values without the entity's derived position (`index`/`order` of an arranged row): it
 * follows the row's rank on each device, so no snapshot or merge ever writes it and no conflict
 * ever asks about it.
 */
export function withoutDerivedPosition(
  entityType: string,
  values: Record<string, any>,
): Record<string, any> {
  const arranged = ARRANGED[entityType];
  if (!arranged || !(arranged.positionField in values)) return values;
  const { [arranged.positionField]: _position, ...rest } = values;
  return rest;
}

/**
 * Combines a pending conflict's server snapshot with fresher server information. Pull-side
 * snapshots are deltas (one remote operation's values) and push-side ones are whole rows, so
 * merging - newer values over older - is right for every mix, and the result is never older
 * than either side. `null` means the entity is gone from the server, and replaces. An incoming
 * snapshot older than the held one is `stale` and must not be applied.
 */
export function foldServerSnapshot(
  existing: { serverValues: string | null; serverVersion: number | null },
  incomingValues: Record<string, any> | null | undefined,
  incomingVersion: number | null | undefined,
): { serverValues: string | null; serverVersion: number | null; stale: boolean } {
  if (incomingValues === undefined) {
    return {
      serverValues: existing.serverValues,
      serverVersion: existing.serverVersion,
      stale: false,
    };
  }
  if (
    typeof existing.serverVersion === 'number' &&
    typeof incomingVersion === 'number' &&
    incomingVersion < existing.serverVersion
  ) {
    return {
      serverValues: existing.serverValues,
      serverVersion: existing.serverVersion,
      stale: true,
    };
  }
  const serverVersion =
    typeof incomingVersion === 'number' ? incomingVersion : existing.serverVersion;
  if (incomingValues === null) return { serverValues: null, serverVersion, stale: false };
  const held = parseJson<Record<string, any> | null>(existing.serverValues, null);
  const merged: Record<string, any> = { ...(held ?? {}), ...incomingValues };
  return { serverValues: JSON.stringify(merged), serverVersion, stale: false };
}

/**
 * Takes an operation the server turned out to have applied (its push answer was lost) out of the
 * pending conflict holding it: the conflict was about whether it could land, and it did. A conflict
 * left with no operation of its own has nothing more to decide and closes as the local side kept.
 * Returns whether any conflict changed.
 */
export async function detachLandedOperation(
  db: AppDrizzleClient,
  storyId: string,
  operationId: string,
): Promise<boolean> {
  const pending = await db.query.syncConflicts.findMany({
    where: and(
      eq(schema.syncConflicts.storyId, storyId),
      eq(schema.syncConflicts.status, 'pending'),
    ),
  });
  let changed = false;
  for (const conflict of pending) {
    const ids = parseJson<string[]>(conflict.localOperationIds, []);
    if (!ids.includes(operationId)) continue;
    const remaining = ids.filter((id) => id !== operationId);
    await db
      .update(schema.syncConflicts)
      .set(
        remaining.length > 0
          ? { localOperationIds: JSON.stringify(remaining) }
          : {
              localOperationIds: '[]',
              status: 'resolved',
              resolution: 'keep_local',
              resolvedAt: new Date(),
            },
      )
      .where(eq(schema.syncConflicts.id, conflict.id));
    changed = true;
  }
  return changed;
}

/**
 * The server moved the entity to `version` (an operation acked, pulled or reported on it): every
 * conflict still pending on it learns the version - a resolution aligns the row to its conflict's.
 * Values stay as they are; only a newer version is taken.
 */
export async function raiseConflictsServerVersion(
  db: AppDrizzleClient,
  storyId: string,
  entityType: string,
  entityId: string,
  version: number | null | undefined,
): Promise<void> {
  if (typeof version !== 'number') return;
  await db
    .update(schema.syncConflicts)
    .set({ serverVersion: version })
    .where(
      and(
        eq(schema.syncConflicts.storyId, storyId),
        eq(schema.syncConflicts.entityType, entityType),
        eq(schema.syncConflicts.entityId, entityId),
        eq(schema.syncConflicts.status, 'pending'),
        or(
          isNull(schema.syncConflicts.serverVersion),
          lt(schema.syncConflicts.serverVersion, version),
        ),
      ),
    );
}
