import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, type CompatibleDb } from '../../db';
import { operationLog } from '../../db/schema';

/**
 * Server-side history compaction ("squash") for the sync operation log.
 *
 * Every accepted push appends one history row, so a scene edited 50 times leaves 50 full-body
 * copies behind. Compaction replaces a run of old `update` rows on one entity with a single row
 * carrying the merged final state - the row keeps the run's max `operationVersion`, so the story's
 * version sequence stays valid and no cursor ever goes stale.
 *
 * This is safe because updates are state-based, not deltas: `changes` carries each field's full
 * new value (last-writer-wins per field). A client pulling from inside a squashed range receives
 * the merged row and applies the final state; re-applying values it already knew is harmless.
 *
 * What is never squashed:
 * - `create` rows: they are the authoritative idempotency record for retried creates (see
 *   `SyncPushService`), and the full data a client pulling from zero needs first.
 * - `delete` / `reorder` rows: structural operations define existence and order. A squash run
 *   never crosses one, so entity-version ranges (used by `getChangedFieldsSinceVersion`) and
 *   the recovery narrative stay truthful.
 * - the newest K updates per entity and anything recent: granular history is what conflict
 *   review reads.
 * - across users for `Favorite`: pulls filter favourites by `userId` in individual mode, so a
 *   run mixing authors would hide one author's row under another's id.
 */

/** The metadata the planner needs; payloads are fetched only for runs that will squash. */
export interface CompactableOperation {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  operationType: string;
  operationVersion: number;
  createdAt: Date;
}

export interface UpdateSquashRun {
  /** Last row of the run: kept, its payload replaced by the merged final state. */
  keepId: string;
  operationVersion: number;
  deleteIds: string[];
}

export interface HistoryCompactionPolicy {
  /** Only squash updates strictly older than this. */
  olderThan: Date;
  /** The newest N updates per entity are never squashed. */
  keepRecentPerEntity: number;
}

export const DEFAULT_KEEP_RECENT_PER_ENTITY = 20;
export const DEFAULT_SQUASH_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function defaultCompactionPolicy(now: Date = new Date()): HistoryCompactionPolicy {
  return {
    olderThan: new Date(now.getTime() - DEFAULT_SQUASH_AGE_MS),
    keepRecentPerEntity: DEFAULT_KEEP_RECENT_PER_ENTITY,
  };
}

const entityKey = (op: Pick<CompactableOperation, 'entityType' | 'entityId'>): string =>
  `${op.entityType}\n${op.entityId}`;

/**
 * Plans which update runs collapse, without touching the database. Input order does not matter;
 * everything is decided in `operationVersion` order.
 */
export function planUpdateSquash(
  ops: CompactableOperation[],
  policy: HistoryCompactionPolicy,
): UpdateSquashRun[] {
  const sorted = [...ops].sort((left, right) => left.operationVersion - right.operationVersion);

  // The newest K updates per entity stay granular, whatever their age.
  const updateIdsByEntity = new Map<string, string[]>();
  for (const op of sorted) {
    if (op.operationType !== 'update') continue;
    const bucket = updateIdsByEntity.get(entityKey(op));
    if (bucket) bucket.push(op.id);
    else updateIdsByEntity.set(entityKey(op), [op.id]);
  }
  const protectedIds = new Set<string>();
  // `slice(-0)` is `slice(0)`: with no retention budget, nothing is protected.
  if (policy.keepRecentPerEntity > 0) {
    for (const ids of updateIdsByEntity.values()) {
      for (const id of ids.slice(-policy.keepRecentPerEntity)) protectedIds.add(id);
    }
  }

  // A run never crosses an entity, a structural op, or (for favourites) an author.
  const segments: CompactableOperation[][] = [];
  const openByEntity = new Map<string, CompactableOperation[]>();
  for (const op of sorted) {
    const key = entityKey(op);
    if (op.operationType !== 'update') {
      const open = openByEntity.get(key);
      if (open && open.length > 0) segments.push(open);
      openByEntity.delete(key);
      continue;
    }
    const open = openByEntity.get(key);
    if (op.entityType === 'Favorite' && open && open.length > 0 && open[0]!.userId !== op.userId) {
      segments.push(open);
      openByEntity.set(key, [op]);
      continue;
    }
    if (open) open.push(op);
    else openByEntity.set(key, [op]);
  }
  for (const open of openByEntity.values()) {
    if (open.length > 0) segments.push(open);
  }

  const runs: UpdateSquashRun[] = [];
  for (const segment of segments) {
    // `createdAt` comes from client clocks (bounded only against the future), so it can disagree
    // with version order: squash maximal contiguous runs of eligible rows, whatever shape that is.
    let current: CompactableOperation[] = [];
    const flush = () => {
      if (current.length >= 2) {
        const keep = current[current.length - 1]!;
        runs.push({
          keepId: keep.id,
          operationVersion: keep.operationVersion,
          deleteIds: current.slice(0, -1).map((row) => row.id),
        });
      }
      current = [];
    };
    for (const op of segment) {
      if (op.createdAt.getTime() < policy.olderThan.getTime() && !protectedIds.has(op.id)) {
        current.push(op);
      } else {
        flush();
      }
    }
    flush();
  }
  return runs;
}

/** Merges run payloads oldest-first; updates are state-based, so later values win per field. */
export function mergeRunPayloads(payloads: Record<string, unknown>[]): Record<string, unknown> {
  return Object.assign({}, ...payloads);
}

/**
 * Squashes old update runs for one story. Crash-safe without a transaction: the kept row is
 * rewritten *before* the earlier rows are deleted, so an interruption leaves states that merely
 * apply twice (state-based: applying an early op and then the merged final state converges),
 * and the next compaction idempotently finishes the job.
 */
export async function compactStoryUpdateHistory(
  storyId: string,
  policy: HistoryCompactionPolicy = defaultCompactionPolicy(),
  database: CompatibleDb = db,
): Promise<{ runs: number; removedRows: number }> {
  const metas = (await database.query.operationLog.findMany({
    where: eq(operationLog.storyId, storyId),
    columns: {
      id: true,
      entityType: true,
      entityId: true,
      userId: true,
      operationType: true,
      operationVersion: true,
      createdAt: true,
    },
    orderBy: [asc(operationLog.operationVersion)],
  })) as CompactableOperation[];

  const runs = planUpdateSquash(metas, policy);
  let removedRows = 0;
  for (const run of runs) {
    const rows = await database.query.operationLog.findMany({
      where: and(
        eq(operationLog.storyId, storyId),
        inArray(operationLog.id, [...run.deleteIds, run.keepId]),
      ),
      columns: { id: true, payload: true, operationVersion: true },
      orderBy: [asc(operationLog.operationVersion)],
    });
    // A concurrent compaction (or admin restore rewriting history) may have taken the run first:
    // only squash when every member is still exactly where the plan left it.
    if (rows.length !== run.deleteIds.length + 1) continue;
    const merged = mergeRunPayloads(
      rows.map((row) => (row.payload ?? {}) as Record<string, unknown>),
    );
    await database
      .update(operationLog)
      .set({ payload: merged })
      .where(eq(operationLog.id, run.keepId));
    await database.delete(operationLog).where(inArray(operationLog.id, run.deleteIds));
    removedRows += run.deleteIds.length;
  }
  return { runs: runs.length, removedRows };
}
