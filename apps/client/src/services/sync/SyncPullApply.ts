import type { StoryUpdate } from '@keres/shared';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';
import type { OperationLogSelect } from '../../db/schema';
import type { ClientSyncEntityHandler } from '../entity-sync-handlers/ClientSyncEntityHandler';
import { withOpLogLock } from '../../utils/opLogMutex';
import type { SyncNotifier } from './SyncNotifier';
import type { SyncPull } from './SyncPull';
import { FAVORITE_TARGET_EVENTS, SYNC_ENTITY_EVENTS } from './syncEvents';
import {
  describeIncorporatedOperation,
  type IncorporatedOperation,
  maskSupersededUpdate,
  protectRemoteUpdate,
  syncEntityKey,
  withRankProtocol,
} from './syncPure';

/**
 * Consecutive apply-failures after which a poisoned remote operation is skipped (recorded, cursor
 * advanced) instead of blocking the pull forever. Unknown entities and operation types never
 * skip: they fail closed.
 */
const MAX_REMOTE_OPERATION_FAILURES = 3;

/** Operation types this build can interpret; anything else is a newer server talking past the app. */
const KNOWN_OPERATION_TYPES: ReadonlySet<string> = new Set(['create', 'update', 'delete']);

/**
 * Counts apply-failures per remote operation. The per-story operation version identifies it; an
 * update without one falls back to its server id so two unversioned operations never share a
 * counter and retire each other early.
 */
const remoteFailureKey = (update: StoryUpdate): number | string =>
  update.operationVersion || update.operationId || 0;

export interface SyncPullApplyDependencies {
  pull: SyncPull;
  /** Every unsynchronized local operation of one entity (pushable or held in a conflict). */
  getUnsyncedOperationsForEntity: (
    entityType: string,
    entityId: string,
  ) => Promise<OperationLogSelect[]>;
  entityHandlers: Map<string, ClientSyncEntityHandler>;
  notifier: SyncNotifier;
  events: { emit(event: string, ...args: unknown[]): void };
}

export interface SyncPullApplyInput {
  db: AppDrizzleClient;
  storyId: string;
  remoteUpdates: StoryUpdate[];
  /** Advances the pull cursors; called for every op that is applied, echoed, or retired. */
  markApplied: (update: StoryUpdate) => void;
}

/**
 * Applies one pull batch to the local database. Extracted from the engine so the cycle
 * coordinator stays readable; the engine still owns fetching, cursors, push, and media.
 */
export class SyncPullApply {
  /** Consecutive apply-failures per remote operation; a success clears the entry. */
  private readonly failureCounts = new Map<number | string, number>();

  public constructor(private readonly dependencies: SyncPullApplyDependencies) {}

  /** Failure counts are keyed by per-story operation versions; a new story must not inherit them. */
  public reset(): void {
    this.failureCounts.clear();
  }

  /**
   * Synchronized operations past the first one of this batch in server order, by entity: what
   * `maskSupersededUpdate` needs to keep a lagging pull from rolling back history this device
   * already holds. Loaded once per batch - the set is small (what was pushed or applied since the
   * cursor), and rows this batch records sit below the operation being applied, so they never
   * matter for it.
   */
  private async loadIncorporatedOperations(
    db: AppDrizzleClient,
    storyId: string,
    remoteUpdates: StoryUpdate[],
  ): Promise<Map<string, IncorporatedOperation[]>> {
    const byEntity = new Map<string, IncorporatedOperation[]>();
    const versions = remoteUpdates.map((update) => update.operationVersion ?? 0);
    if (versions.length === 0) return byEntity;
    const rows = await db.query.operationLogs.findMany({
      where: and(
        eq(schema.operationLogs.storyId, storyId),
        eq(schema.operationLogs.isSynced, true),
        isNull(schema.operationLogs.conflictState),
        gt(schema.operationLogs.serverOperationVersion, Math.min(...versions)),
      ),
      columns: {
        entityType: true,
        entityId: true,
        operationType: true,
        payload: true,
        serverOperationVersion: true,
      },
    });
    const add = (key: string, entry: IncorporatedOperation) => {
      const bucket = byEntity.get(key);
      if (bucket) bucket.push(entry);
      else byEntity.set(key, [entry]);
    };
    for (const row of rows) {
      const described = describeIncorporatedOperation(row);
      if (described) add(syncEntityKey(row.entityType, row.entityId), described);
    }
    return byEntity;
  }

  /**
   * One remote operation, under the story's op-log lock: masked by the history this device already
   * holds, reconciled with the entity's unsynchronized operations when it has any, applied directly
   * otherwise. `record` writes it to the local log in the same transaction as its effect. Returns
   * whether a conflict was recorded.
   */
  private async applyRemoteOperation(
    db: AppDrizzleClient,
    storyId: string,
    incoming: StoryUpdate,
    handler: ClientSyncEntityHandler,
    incorporatedByEntity: Map<string, IncorporatedOperation[]>,
    markEntityUpdated: (entity: string, entityId?: string) => void,
    record: (tx: AppDrizzleTransaction) => Promise<void>,
  ): Promise<boolean> {
    const { pull } = this.dependencies;
    let update = incoming;
    const incorporated = incorporatedByEntity.get(syncEntityKey(update.entity, update.id || ''));
    if (incorporated && incorporated.length > 0) {
      const exists =
        update.type === 'create' && update.id ? !!(await handler.getById(update.id)) : true;
      const masked = maskSupersededUpdate(update, incorporated, exists);
      if (!masked) {
        // Everything it wrote was superseded by history this device already holds.
        await db.transaction(record);
        return false;
      }
      update = masked;
    }

    const pendingLocalOps = await this.dependencies.getUnsyncedOperationsForEntity(
      update.entity,
      update.id || '',
    );
    if (pendingLocalOps.length > 0) {
      const outcome = await pull.reconcileRemoteUpdate(update, pendingLocalOps, handler);
      markEntityUpdated(update.entity, update.id);
      await db.transaction(record);
      return outcome.conflicted;
    }

    // The apply and its record commit as one unit. Applied but unrecorded is the worst split: the
    // next launch re-applies while the cursor already moved on. The lock held around the
    // transaction keeps a concurrent local write from joining it and being rolled back with an
    // apply failure.
    await db.transaction(async (tx) => {
      // Handlers hold the database from bind time; rebind to the transaction for the apply so the
      // entity write joins it. The engine runs one cycle at a time and the binding is restored
      // below, so no other applier can observe the swap.
      handler.setDb(tx);
      try {
        if (update.type === 'create') {
          await pull.applyRemoteCreate(update, handler);
        } else if (update.type === 'update') {
          await handler.applyUpdate(storyId, update);
        } else if (update.type === 'delete') {
          await pull.applyRemoteDelete(update, handler, tx);
        }
        await record(tx);
        markEntityUpdated(update.entity, update.id);
      } finally {
        handler.setDb(db);
      }
    });
    return false;
  }

  public async applyBatch(input: SyncPullApplyInput): Promise<{ blocked: boolean }> {
    const { db, storyId, remoteUpdates, markApplied } = input;
    const { pull, entityHandlers, notifier, events } = this.dependencies;

    const totalUpdates = remoteUpdates.length;
    const entitiesUpdated: string[] = [];
    const failedEntities: string[] = [];
    const changedEntityIds = new Map<string, Set<string>>();

    const markEntityUpdated = (entity: string, entityId?: string) => {
      if (!entitiesUpdated.includes(entity)) {
        entitiesUpdated.push(entity);
      }
      if (entityId) {
        const ids = changedEntityIds.get(entity) ?? new Set<string>();
        ids.add(entityId);
        changedEntityIds.set(entity, ids);
      }
    };

    console.log(`Received ${totalUpdates} remote updates. Applying to local DB...`);

    const incorporatedByEntity = await this.loadIncorporatedOperations(db, storyId, remoteUpdates);
    let conflictsDetected = 0;
    let pullBlocked = false;

    const markSuccess = (update: StoryUpdate) => {
      // A success breaks the consecutive-failure chain, so transient failures recover on retry.
      this.failureCounts.delete(remoteFailureKey(update));
      markApplied(update);
    };

    for (const rawUpdate of remoteUpdates) {
      if (pullBlocked) break;

      const update = withRankProtocol(protectRemoteUpdate(rawUpdate));
      const handler = entityHandlers.get(update.entity);
      if (!handler) {
        // An entity this build cannot store: the server is newer than the app. The pull
        // stays blocked (skipping would lose these operations below the cursor, even after
        // an upgrade), but loudly - as a protocol mismatch, not a silent stall.
        console.log(`No client sync handler registered for entity type: ${update.entity}`);
        notifier.protocolMismatch();
        pullBlocked = true;
        break;
      }

      if (update.entity === 'Story' && update.type === 'create' && update.id !== storyId) {
        console.warn(`Ignoring Story create for ${update.id} while syncing ${storyId}.`);
        await pull.recordRemoteOperationLocally(rawUpdate);
        markSuccess(rawUpdate);
        continue;
      }

      // An operation this very client sent and the server is handing back. It is already applied here;
      // reapplying it would only duplicate the row in the local log. The row's content still aligns
      // with what the server recorded: it may have normalized a value, and a deletion or restore
      // carries the whole row, whose fields this device may never have sent - see
      // `alignEchoedWholeRow`.
      if (await pull.isOwnEchoedOperation(rawUpdate)) {
        // Hygiene, never a reason to stall the pull: a failure leaves the row as it was.
        await withOpLogLock(storyId, async () => {
          const pending = await this.dependencies.getUnsyncedOperationsForEntity(
            update.entity,
            update.id || '',
          );
          if (pending.length > 0) return;
          const incorporated =
            incorporatedByEntity.get(syncEntityKey(update.entity, update.id || '')) ?? [];
          const masked =
            incorporated.length > 0 ? maskSupersededUpdate(update, incorporated, true) : update;
          if (masked) await pull.alignEchoedWholeRow(masked, handler);
        }).catch((alignError) => {
          console.warn(`Could not align ${update.entity} ${update.id} with its echo:`, alignError);
        });
        markSuccess(rawUpdate);
        continue;
      }

      if (!KNOWN_OPERATION_TYPES.has(update.type)) {
        // An operation type this build cannot interpret: the server is newer than the app. Like
        // an unknown entity, the pull stays blocked (skipping would lose this operation below
        // the cursor, even after an upgrade), but loudly - as a protocol mismatch, not a
        // silent stall.
        console.log(`No client sync handler for remote operation type: ${update.type}`);
        notifier.protocolMismatch();
        pullBlocked = true;
        break;
      }

      try {
        // Everything below runs under the story's op-log lock, and the entity's unsynchronized
        // operations are read inside it: a decision made on a list read earlier would miss an edit
        // recorded in between and overwrite it as if it did not exist.
        const conflicted = await withOpLogLock(storyId, async () =>
          this.applyRemoteOperation(
            db,
            storyId,
            update,
            handler,
            incorporatedByEntity,
            markEntityUpdated,
            (tx) => pull.recordRemoteOperationLocally(rawUpdate, tx),
          ),
        );
        if (conflicted) conflictsDetected += 1;
        markSuccess(rawUpdate);
      } catch (handlerError) {
        const failureKey = remoteFailureKey(update);
        const failures = (this.failureCounts.get(failureKey) ?? 0) + 1;
        this.failureCounts.set(failureKey, failures);
        if (!failedEntities.includes(update.entity)) {
          failedEntities.push(update.entity);
        }
        // A poisoned operation must not stall the pull forever: after N consecutive failures
        // it is retired like an empty reorder (recorded, cursor advanced) while still reported.
        if (failures >= MAX_REMOTE_OPERATION_FAILURES) {
          console.warn(
            `Skipping remote ${update.type} for entity ${update.entity} ID ${update.id} after ${failures} consecutive failures.`,
          );
          await pull.recordRemoteOperationLocally(rawUpdate);
          markSuccess(rawUpdate);
          continue;
        }
        pullBlocked = true;
        console.log(
          `Error applying ${update.type} for entity ${update.entity} ID ${update.id}:`,
          handlerError,
        );
      }
    }

    // One consolidated notification per sync cycle instead of one per failed
    // item - a single flaky entity type shouldn't flood the user with a
    // notification for every record it touches.
    if (entitiesUpdated.length > 0) {
      notifier.remoteUpdatesReceived(totalUpdates, entitiesUpdated);
    }
    if (failedEntities.length > 0) {
      notifier.remoteUpdatesFailed(failedEntities);
    }
    if (conflictsDetected > 0) {
      notifier.conflictsDetected(conflictsDetected);
    }
    // Emit events after the whole pull so a batch causes one refresh per
    // affected entity type instead of one query per operation.
    for (const [entity, ids] of changedEntityIds) {
      const eventName = SYNC_ENTITY_EVENTS[entity];
      if (!eventName) continue;
      for (const entityId of ids) {
        if (entity === 'Favorite') {
          const favorite = await db.query.favorites.findFirst({
            where: eq(schema.favorites.id, entityId),
            columns: { entityId: true, entityType: true, userId: true },
          });
          if (favorite) {
            events.emit(
              'favorite_changed',
              storyId,
              favorite.entityType,
              favorite.entityId,
              favorite.userId,
            );
          }
          const targetEvent = favorite && FAVORITE_TARGET_EVENTS[favorite.entityType];
          if (targetEvent) events.emit(targetEvent, storyId, favorite.entityId);
        } else {
          events.emit(eventName, storyId, entityId);
        }
      }
    }
    // A scene reads as unchaptered while its chapter is deleted: chapter changes reach scene lists.
    if (changedEntityIds.has('Chapter') && !changedEntityIds.has('Scene')) {
      events.emit('scene_changed', storyId);
    }
    events.emit('story_data_changed', {
      storyId,
      entityTypes: Array.from(changedEntityIds.keys()),
      entityIds: Object.fromEntries(
        Array.from(changedEntityIds.entries()).map(([entity, ids]) => [entity, Array.from(ids)]),
      ),
      source: 'sync',
    });

    // Emit event to signal operation log update after applying remote updates
    events.emit('operation_log_updated', storyId);
    return { blocked: pullBlocked };
  }
}
