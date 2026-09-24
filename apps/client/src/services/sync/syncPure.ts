import type { CreateStoryUpdate, StoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { omitClientProtectedFields, toEntityColumns } from '../entityTableRegistry';

/**
 * Pure sync helpers, free of database and network access so they stay unit-testable.
 *
 * The key invariant here is the version convention: every local write stores the
 * *resulting* version in the operation payload, while the server's optimistic
 * concurrency check needs the *base* the edit was made on.
 */

/**
 * Recovers the base version from a local payload (`resulting - 1`).
 *
 * `SyncPush` sends this as the operation's `version` so the server can detect an
 * interleaving write; `undefined` means the payload carries no version and the
 * operation must be skipped rather than sent with a fabricated base.
 */
export function deriveBaseVersion(payload: Record<string, any>): number | undefined {
  const resultingVersion = payload?.version;
  return typeof resultingVersion === 'number' && resultingVersion >= 1
    ? resultingVersion - 1
    : undefined;
}

/** `EntityType:entityId` key used to group pending operations and conflicts per entity. */
export function syncEntityKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

/**
 * Throws when the scheduler stopped the active cycle (context switch / stopAndWait). The name
 * is what `isAbortError` recognises, so an aborted cycle unwinds quietly instead of reporting
 * a sync failure.
 */
export function throwIfSyncAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    const error = new Error('Sync cycle aborted.');
    error.name = 'AbortError';
    throw error;
  }
}

/**
 * Strips local bookkeeping columns before a server update reaches a client handler.
 *
 * Without this, applying a remote create/update could overwrite the row's sync cursors
 * (`lastOperationLog`, `myRole`, ...) with whatever the server echoed back. Keys that are
 * not columns of the local table are dropped too: a newer server's extra field (or a junk
 * key) would otherwise reach a handler's raw `.set()` spread, fail the apply, and block
 * the pull cursor behind one unprocessable operation. Deletes and reorders carry no
 * entity fields, so they pass through untouched.
 */
export function protectRemoteUpdate(update: StoryUpdate): StoryUpdate {
  if (update.type === 'create') {
    return {
      ...update,
      data: toEntityColumns(update.entity, omitClientProtectedFields(update.entity, update.data)),
    } as CreateStoryUpdate;
  }
  if (update.type === 'update') {
    return {
      ...update,
      changes: toEntityColumns(
        update.entity,
        omitClientProtectedFields(update.entity, update.changes),
      ),
    } as UpdateStoryUpdate;
  }
  return update;
}
