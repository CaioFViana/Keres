import type {
  ChapterReorderingStoryUpdate,
  StoryReorderingStoryUpdate,
  StoryUpdate,
} from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../../db';
import * as schema from '../../db/schema';
import type { OperationLogSelect } from '../../db/schema';
import type { ClientSyncEntityHandler } from '../entity-sync-handlers/ClientSyncEntityHandler';
import { withOpLogLock } from '../../utils/opLogMutex';
import { applyReorderToLocalDb } from './applyReorderToLocalDb';
import type { SyncNotifier } from './SyncNotifier';
import type { SyncPull } from './SyncPull';
import { FAVORITE_TARGET_EVENTS, SYNC_ENTITY_EVENTS } from './syncEvents';
import { protectRemoteUpdate, syncEntityKey } from './syncPure';

/**
 * Consecutive apply-failures after which a poisoned remote operation is skipped (recorded, cursor
 * advanced) instead of blocking the pull forever. Unknown entities and operation types never
 * skip: they fail closed.
 */
const MAX_REMOTE_OPERATION_FAILURES = 3;

/** Operation types this build can interpret; anything else is a newer server talking past the app. */
const KNOWN_OPERATION_TYPES: ReadonlySet<string> = new Set([
  'create',
  'update',
  'delete',
  'reorder',
]);

/**
 * Counts apply-failures per remote operation. The per-story operation version identifies it; an
 * update without one falls back to its server id so two unversioned operations never share a
 * counter and retire each other early.
 */
const remoteFailureKey = (update: StoryUpdate): number | string =>
  update.operationVersion || update.operationId || 0;

export interface SyncPullApplyDependencies {
  pull: SyncPull;
  getPendingOperationsByEntity: () => Promise<Map<string, OperationLogSelect[]>>;
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

    // Local operations not yet accepted by the server, indexed by entity. They are what remote updates can
    // collide with: applying the remote version on top would silently erase what the user wrote offline.
    const pendingByEntity = await this.dependencies.getPendingOperationsByEntity();
    let conflictsDetected = 0;
    let pullBlocked = false;

    const markSuccess = (update: StoryUpdate) => {
      // A success breaks the consecutive-failure chain, so transient failures recover on retry.
      this.failureCounts.delete(remoteFailureKey(update));
      markApplied(update);
    };

    for (const rawUpdate of remoteUpdates) {
      if (pullBlocked) break;

      const update = protectRemoteUpdate(rawUpdate);
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
      // reapplying it would only duplicate the row in the local log.
      if (await pull.isOwnEchoedOperation(rawUpdate)) {
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

      const pendingLocalOps =
        pendingByEntity.get(syncEntityKey(update.entity, update.id || '')) || [];

      try {
        if (pendingLocalOps.length > 0) {
          const outcome = await pull.reconcileRemoteUpdate(update, pendingLocalOps, handler);
          if (outcome.conflicted) {
            conflictsDetected += 1;
          }
          markEntityUpdated(update.entity, update.id);
          await pull.recordRemoteOperationLocally(rawUpdate);
          markSuccess(rawUpdate);
          continue;
        }

        if (update.type === 'reorder') {
          const reorderUpdate = update as ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate;

          // An order with no items carries no information: the server refuses to log new
          // ones, so anything arriving here is foreign or legacy history. Skipping past it
          // (recorded, cursor advanced) instead of blocking keeps one such row from
          // stalling this story's pull forever.
          if (!reorderUpdate.reorderItems || reorderUpdate.reorderItems.length === 0) {
            console.warn(
              `Reorder update for entity ${update.entity} ID ${update.id} has no reorderItems; skipping.`,
            );
            await pull.recordRemoteOperationLocally(rawUpdate);
            markSuccess(rawUpdate);
            continue;
          }
        }

        // The apply and its record commit as one unit under the story's op-log lock. Applied
        // but unrecorded is the worst split: the next launch re-applies (a reorder bumps every
        // touched version a second time) while the cursor already moved on. The lock is held
        // across the transaction so a concurrent local write cannot join it and be rolled back
        // with an apply failure.
        await withOpLogLock(storyId, async () => {
          await db.transaction(async (tx) => {
            // Handlers hold the database from bind time; rebind to the transaction for the
            // apply so the entity write joins it. The engine runs one cycle at a time and the
            // binding is restored below, so no other applier can observe the swap.
            handler.setDb(tx);
            try {
              if (update.type === 'create') {
                await pull.applyRemoteCreate(update, handler);
              } else if (update.type === 'update') {
                await handler.applyUpdate(storyId, update);
              } else if (update.type === 'delete') {
                await handler.applyDelete(storyId, update);
              } else {
                // Only 'reorder' reaches here: unknown types are stopped before dispatch, so
                // this `else` needs no further check - and no silent fall-through may ever
                // skip an op.
                await applyReorderToLocalDb(
                  db,
                  update as ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate,
                  new Date(update.operationTime!),
                  { tx },
                );
              }
              await pull.recordRemoteOperationLocally(rawUpdate, tx);
              markEntityUpdated(update.entity, update.id);
            } finally {
              handler.setDb(db);
            }
          });
        });
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
