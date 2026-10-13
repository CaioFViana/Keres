import { and, asc, eq, inArray } from 'drizzle-orm';
import { decodeTime } from 'ulid';
import { env } from '../../config/env';
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
 * - `delete` rows: structural operations define existence. A squash run never crosses one, so
 *   entity-version ranges (used by `getChangedFieldsSinceVersion`) and the recovery narrative stay
 *   truthful.
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

/** How long an entity's updates stay granular, and how many of its newest ones always do. */
export interface EntityCompactionRule {
  /** Only squash updates strictly older than this. */
  olderThan: Date;
  /** The newest N updates per entity are never squashed. */
  keepRecentPerEntity: number;
}

export interface HistoryCompactionPolicy extends EntityCompactionRule {
  /**
   * Rules of the entity types that differ from the general one: the heavy ones, whose every update carries a large
   * payload (see `HEAVY_ENTITY_TYPES`). A type not named here follows the general rule above.
   */
  byEntityType?: Record<string, EntityCompactionRule>;
}

export const DEFAULT_KEEP_RECENT_PER_ENTITY = 20;
export const DEFAULT_SQUASH_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The entity types whose updates are big - a scene's body, a sketch's strokes, a board, a map, a song - so that
 * every kept update is a whole large copy. They squash sooner and keep fewer granular updates: the history of a
 * body edited fifty times is fifty bodies, and nobody reviews edit number thirty. Conflict detection is not
 * weakened by it: the merged row keeps every changed field and the run's last version (see the header).
 */
export const HEAVY_ENTITY_TYPES = ['Scene', 'Sketch', 'Board', 'LocationMap', 'Song'] as const;
export const DEFAULT_HEAVY_KEEP_RECENT_PER_ENTITY = 3;
export const DEFAULT_HEAVY_SQUASH_AGE_MS = 48 * 60 * 60 * 1000;

export function defaultCompactionPolicy(now: Date = new Date()): HistoryCompactionPolicy {
  const heavy: EntityCompactionRule = {
    olderThan: new Date(now.getTime() - env.SYNC_SQUASH_HEAVY_AGE_HOURS * HOUR_MS),
    keepRecentPerEntity: env.SYNC_SQUASH_HEAVY_KEEP_RECENT,
  };
  return {
    olderThan: new Date(now.getTime() - env.SYNC_SQUASH_AGE_DAYS * 24 * HOUR_MS),
    keepRecentPerEntity: env.SYNC_SQUASH_KEEP_RECENT,
    byEntityType: Object.fromEntries(HEAVY_ENTITY_TYPES.map((type) => [type, heavy])),
  };
}

const HOUR_MS = 60 * 60 * 1000;

/** The rule an entity type follows: its own when the policy names it, the general one otherwise. */
function ruleFor(policy: HistoryCompactionPolicy, entityType: string): EntityCompactionRule {
  return policy.byEntityType?.[entityType] ?? policy;
}

const entityKey = (op: Pick<CompactableOperation, 'entityType' | 'entityId'>): string =>
  `${op.entityType}\n${op.entityId}`;

/**
 * When the SERVER recorded the row: its id is a ULID minted at append time, so it carries the
 * server's clock. `createdAt` is the client's operation time - a device whose clock ran days
 * behind made its history "old" the moment it landed, squashing edits other devices had not
 * pulled yet. Rows whose id is not a ULID fall back to `createdAt`.
 */
export function recordedAt(op: Pick<CompactableOperation, 'id' | 'createdAt'>): number {
  try {
    return decodeTime(op.id);
  } catch {
    return op.createdAt.getTime();
  }
}

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
  const updatesByEntity = new Map<string, { entityType: string; ids: string[] }>();
  for (const op of sorted) {
    if (op.operationType !== 'update') continue;
    const bucket = updatesByEntity.get(entityKey(op));
    if (bucket) bucket.ids.push(op.id);
    else updatesByEntity.set(entityKey(op), { entityType: op.entityType, ids: [op.id] });
  }
  const protectedIds = new Set<string>();
  for (const { entityType, ids } of updatesByEntity.values()) {
    const keep = ruleFor(policy, entityType).keepRecentPerEntity;
    // `slice(-0)` is `slice(0)`: with no retention budget, nothing is protected.
    if (keep > 0) for (const id of ids.slice(-keep)) protectedIds.add(id);
  }

  // A run never crosses an entity, a structural op, or (for favourites) an author. Every write of a
  // row is logged on that row - its place (`rank`) included - so its history is its own.
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
    // Age comes from the server clock (`recordedAt`), but retention still protects the newest rows
    // per entity: squash maximal contiguous runs of eligible rows, whatever shape that is.
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
    const olderThan = ruleFor(policy, segment[0]!.entityType).olderThan.getTime();
    for (const op of segment) {
      if (recordedAt(op) < olderThan && !protectedIds.has(op.id)) {
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
