import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  StoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { ARRANGED } from '@keres/shared';
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
 * A synchronized operation this device has already incorporated - its own, accepted by the
 * server, or a remote one it applied - described by what it wrote.
 */
export interface IncorporatedOperation {
  /** Where the server ordered it in the story's history. */
  serverOperationVersion: number;
  /** Content fields it wrote. */
  fields: ReadonlySet<string>;
  /** It brought a deleted entity back (`isDeleted: false`). */
  restores: boolean;
}

/** Row bookkeeping: never a content field an operation "wrote". */
const OPERATION_BOOKKEEPING = new Set(['id', 'storyId', 'version', 'createdAt', 'updatedAt']);

/** Describes a synchronized local op-log row for `maskSupersededUpdate`; null for unreadable ones. */
export function describeIncorporatedOperation(row: {
  payload: string;
  serverOperationVersion: number | null;
}): IncorporatedOperation | null {
  if (!row.serverOperationVersion) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  const values = payload as Record<string, unknown>;
  return {
    serverOperationVersion: row.serverOperationVersion,
    fields: new Set(Object.keys(values).filter((key) => !OPERATION_BOOKKEEPING.has(key))),
    restores: values.isDeleted === false,
  };
}

/**
 * The part of a remote operation this device has not already superseded.
 *
 * The pull applies history in server order, but it can run BEHIND the push: a pull that keeps
 * failing (or is blocked) while the push goes on, or a push that lands in the same cycle after
 * the pull. The echo check then skips this device's own operation - yet an OLDER remote one on
 * the same fields still arrives afterwards and, applied whole, rolls those fields (and the row's
 * version) back to a state the server left behind. Nothing ever repairs that.
 *
 * The server's value for a field is the last write in its order, so a remote operation keeps
 * only the fields no later incorporated operation wrote, and never moves the version or
 * `updatedAt` once anything later was incorporated (the row already rests past it). Returns
 * `null` when nothing is left to apply. `existsLocally` matters for creates: a create masked
 * over an existing row becomes a plain update of the remaining fields.
 */
export function maskSupersededUpdate(
  update: StoryUpdate,
  incorporated: readonly IncorporatedOperation[],
  existsLocally: boolean,
): StoryUpdate | null {
  const later = incorporated.filter(
    (entry) => entry.serverOperationVersion > (update.operationVersion ?? 0),
  );
  if (later.length === 0) return update;

  const covered = new Set<string>();
  for (const entry of later) for (const field of entry.fields) covered.add(field);

  if (update.type === 'delete') {
    // A later restore proves the entity was brought back after this deletion. Otherwise the
    // deletion stands, but its tombstone must not roll back fields written after it.
    if (later.some((entry) => entry.restores)) return null;
    const data = (update as DeleteStoryUpdate).data;
    if (!data) return update;
    return {
      ...update,
      data: Object.fromEntries(Object.entries(data).filter(([field]) => !covered.has(field))),
    } as DeleteStoryUpdate;
  }
  // A row that does not exist here yet was written by nothing this device incorporated.
  if (update.type === 'create' && !existsLocally) return update;
  const values = update.type === 'create' ? update.data : (update as UpdateStoryUpdate).changes;
  const remaining: Record<string, unknown> = Object.fromEntries(
    Object.entries(values ?? {}).filter(
      ([field]) => !covered.has(field) && field !== 'version' && field !== 'updatedAt',
    ),
  );
  if (Object.keys(remaining).every((field) => OPERATION_BOOKKEEPING.has(field))) return null;
  return {
    ...update,
    type: 'update',
    changes: remaining,
  } as UpdateStoryUpdate;
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
  if (update.type === 'delete' && update.data) {
    return {
      ...update,
      data: toEntityColumns(update.entity, omitClientProtectedFields(update.entity, update.data)),
    } as DeleteStoryUpdate;
  }
  return update;
}

/**
 * A remote operation on an arranged row, in rank terms (see `rules/rank.ts`): its position is
 * derived here by the local rank triggers, so an update never writes one.
 */
export function withRankProtocol(update: StoryUpdate): StoryUpdate {
  const arranged = ARRANGED[update.entity];
  if (!arranged || update.type !== 'update') return update;
  const changes = { ...(update.changes ?? {}) } as Record<string, unknown>;
  delete changes[arranged.positionField];
  return { ...update, changes } as UpdateStoryUpdate;
}

/**
 * Whether values only place a row - its rank, or the container it sits in - and change nothing
 * of its content. A deletion loses nothing to such an edit, so the two never need a decision.
 */
export function onlyPlaces(entityType: string, values: Record<string, unknown>): boolean {
  const arranged = ARRANGED[entityType];
  return Object.keys(values).every(
    (field) =>
      OPERATION_BOOKKEEPING.has(field) ||
      (!!arranged && (field === 'rank' || arranged.containerFields.includes(field))),
  );
}

/** Values that move a row and do nothing else: a place is there, and no content. */
export function onlyMoves(entityType: string, values: Record<string, unknown>): boolean {
  const arranged = ARRANGED[entityType];
  return (
    !!arranged &&
    onlyPlaces(entityType, values) &&
    Object.keys(values).some(
      (field) => field === 'rank' || arranged.containerFields.includes(field),
    )
  );
}
