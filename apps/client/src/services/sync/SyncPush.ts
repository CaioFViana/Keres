import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  StoryUpdate,
  SyncConflict as SharedSyncConflict,
  SyncPushResult,
  UpdateStoryUpdate,
} from '@keres/shared';
import { MAX_SYNC_BATCH_SIZE, safeParseStoryUpdate } from '@keres/shared';
import { and, asc, eq, inArray, isNull, max } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { OperationLogSelect } from '../../db/schema';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { withOpLogLock } from '../../utils/opLogMutex';
import { trimSyncedOperationLogs } from '../../utils/syncUtils';
import { getEntityTable, toEntityColumns } from '../entityTableRegistry';
import { raiseConflictsServerVersion, withoutDerivedPosition } from './syncConflictHelpers';
import { findContestedFields, mergeLocalOperationPayloads } from '../SyncConflictService';
import type { SyncContext } from './SyncContext';
import { foldIntoTwin, isFoldableDuplicate } from './duplicateFold';
import { foldRoutePaths } from './routePaths';
import {
  createStillOnItsWay,
  inSettlingOrder,
  onlyMissingReference,
  waitingOperationIds,
} from './pushRefusals';
import { deriveBaseVersion, onlyMoves, syncEntityKey } from './syncPure';

/** Rounds of push batches per cycle; a larger backlog continues on the next cycle. */
export const PUSH_MAX_ROUNDS = 50;

/** Builds and pushes local batches, then records the server's per-operation result. */
export class SyncPush {
  private readonly maxRounds: number;

  public constructor(
    private readonly context: SyncContext,
    options?: { maxRounds?: number },
  ) {
    this.maxRounds = options?.maxRounds ?? PUSH_MAX_ROUNDS;
  }

  public async pushPendingOperations(): Promise<{ offline: boolean }> {
    const notifier = this.context.notifier();
    let totalApplied = 0;
    let totalConflicts = 0;
    const quarantinedEntities = new Set<string>();
    let roundsRun = 0;
    let lastRemaining = 0;

    for (let chunk = 0; chunk < this.maxRounds; chunk += 1) {
      roundsRun = chunk + 1;
      const pending = await this.getPushableOperations();
      const mapped: { op: OperationLogSelect; update: StoryUpdate }[] = [];
      for (const op of pending) {
        const built = this.tryBuildStoryUpdateFromLocalOp(op);
        if (built.update) {
          mapped.push({ op, update: built.update });
        } else {
          // Visible quarantine: an op the server could never accept becomes a conflict the user
          // can discard, instead of sitting unsynced forever in silence. Leaving the queue counts
          // as progress, so the loop below keeps draining the remaining valid ops.
          try {
            await this.quarantineUnpushableOperation(op, built.reason);
          } catch (quarantineError: any) {
            // The conflicted mark may already have committed while the conflict row did not: the
            // op would sit out of every future queue with no conflict to resolve it, so release
            // it back and retry the quarantine on the next push instead of aborting this one.
            console.log(
              `Quarantine failed for operation ${op.id}, retrying on the next push:`,
              quarantineError?.message || quarantineError,
            );
            await this.context
              .db()!
              .update(schema.operationLogs)
              .set({ conflictState: null })
              .where(eq(schema.operationLogs.id, op.id));
            continue;
          }
          quarantinedEntities.add(syncEntityKey(op.entityType, op.entityId));
        }
      }
      const prepared = mapped.slice(0, MAX_SYNC_BATCH_SIZE);
      if (mapped.length > prepared.length) {
        console.log(
          `Push batch capped at ${MAX_SYNC_BATCH_SIZE} for story ${this.context.storyId()}: ` +
            `sending ${prepared.length} of ${mapped.length} ready operations, ` +
            `${mapped.length - prepared.length} deferred to the next round.`,
        );
      }
      if (prepared.length === 0) break;

      if (chunk === 0) {
        console.log(`Pushing local operations for story ${this.context.storyId()} to server...`);
      }

      const pushResponse = await this.context.client().post<SyncPushResult>(
        `/sync/${this.context.storyId()}`,
        prepared.map((entry) => entry.update),
        { signal: this.context.abortSignal() },
      );
      const summary = await this.applyPushResult(
        pushResponse.data,
        prepared.map((entry) => entry.op),
        { silent: true },
      );
      totalApplied += summary.applied;
      totalConflicts += summary.conflicts;

      const remaining = await this.getPushableOperations();
      lastRemaining = remaining.length;
      if (remaining.length >= pending.length) {
        break;
      }
    }

    if (roundsRun >= this.maxRounds && lastRemaining > 0) {
      console.log(
        `Push hit the ${this.maxRounds}-round ceiling for story ${this.context.storyId()} with ` +
          `${lastRemaining} operations still queued; they continue on the next cycle.`,
      );
    }
    totalConflicts += quarantinedEntities.size;

    if (totalApplied > 0) {
      notifier.pushedUpdates(totalApplied);
    }
    if (totalConflicts > 0) {
      notifier.conflictsDetected(totalConflicts);
    }
    // Retention: synchronized history beyond the newest 100 is display-only weight. Best effort -
    // a trim failure must never fail the push that just succeeded.
    try {
      await trimSyncedOperationLogs(this.context.db()!, this.context.storyId()!);
    } catch (trimError: any) {
      console.log(
        `Error trimming synchronized operations for story ${this.context.storyId()}:`,
        trimError?.message || trimError,
      );
    }
    return { offline: false };
  }

  /**
   * Builds the envelope, or explains why the op can never go to the server. The reason feeds the
   * visible quarantine in `pushPendingOperations`; this never throws, so one corrupted row cannot
   * abort the push of every other pending op.
   *
   * The built envelope is checked against the same shared schema the server applies. A server that
   * validates the batch as a whole answers one malformed operation with a 422 for ALL of them - on
   * every retry - so an envelope it would refuse is quarantined here instead of sent.
   */
  private tryBuildStoryUpdateFromLocalOp(
    op: OperationLogSelect,
  ): { update: StoryUpdate; reason: null } | { update: null; reason: string } {
    const built = this.buildStoryUpdateFromLocalOp(op);
    if (!built.update) return built;
    const checked = safeParseStoryUpdate(built.update);
    if (checked.success) return built;
    const reason =
      `Local ${op.operationType} of ${op.entityType} ${op.entityId} is not a valid sync operation ` +
      `(${checked.error}), so the server would refuse it.`;
    console.warn(reason);
    return { update: null, reason };
  }

  private buildStoryUpdateFromLocalOp(
    op: OperationLogSelect,
  ): { update: StoryUpdate; reason: null } | { update: null; reason: string } {
    let payloadData: Record<string, any> | null = null;
    try {
      const parsed: unknown = JSON.parse(op.payload);
      if (parsed && typeof parsed === 'object') payloadData = parsed as Record<string, any>;
    } catch {
      payloadData = null;
    }
    if (!payloadData) {
      const reason =
        `Local ${op.operationType} of ${op.entityType} ${op.entityId} has a corrupted payload ` +
        `that cannot be parsed, so it can never be pushed.`;
      console.warn(reason);
      return { update: null, reason };
    }
    const baseVersion = deriveBaseVersion(payloadData);

    if (
      (op.operationType === 'update' || op.operationType === 'delete') &&
      typeof baseVersion !== 'number'
    ) {
      const reason =
        `Local ${op.operationType} of ${op.entityType} ${op.entityId} has no version in its ` +
        `payload, so the server would reject it as invalid.`;
      console.warn(reason);
      return { update: null, reason };
    }
    if (op.operationType === 'create' && !op.entityId) {
      const reason = `Local create of ${op.entityType} has no entity id, so the server could never accept it.`;
      console.warn(reason);
      return { update: null, reason };
    }

    const baseUpdate: Omit<StoryUpdate, 'type'> = {
      entity: op.entityType,
      id: op.entityId,
      version: baseVersion,
      operationTime: op.createdAt.toISOString(),
      clientOperationId: op.id,
    };

    const filteredPayloadData: Record<string, any> = { ...payloadData };
    delete filteredPayloadData.createdAt;
    delete filteredPayloadData.updatedAt;
    delete filteredPayloadData.deletedAt;
    delete filteredPayloadData.storyId;

    switch (op.operationType) {
      case 'create':
        return {
          update: {
            ...baseUpdate,
            type: 'create',
            data: filteredPayloadData,
          } as CreateStoryUpdate,
          reason: null,
        };
      case 'update':
        return {
          update: {
            ...baseUpdate,
            type: 'update',
            changes: {
              ...filteredPayloadData,
              version: baseVersion,
            },
          } as UpdateStoryUpdate,
          reason: null,
        };
      case 'delete':
        return {
          update: {
            ...baseUpdate,
            type: 'delete',
          } as DeleteStoryUpdate,
          reason: null,
        };
      default: {
        const reason = `Local operation ${op.id} has an unknown type '${op.operationType}' this client cannot push.`;
        console.warn(reason);
        return { update: null, reason };
      }
    }
  }

  /**
   * Parks an op that can never be pushed as a visible `validation` conflict. The direct update takes
   * it out of the push queue even if the conflict service is stubbed; `recordConflict` marks it too
   * and surfaces it on the review sheet, where keep-server/dismiss abandons the op - so this is never
   * a silent loss, only a decision handed to the user.
   */
  private async quarantineUnpushableOperation(
    op: OperationLogSelect,
    reason: string,
  ): Promise<void> {
    let localValues: Record<string, any> = {};
    let unparseable = false;
    try {
      const parsed: unknown = JSON.parse(op.payload);
      if (parsed && typeof parsed === 'object') {
        localValues = { ...(parsed as Record<string, any>) };
      } else {
        unparseable = true;
      }
    } catch {
      unparseable = true;
    }
    // A row can carry an operation type this build does not know; the conflict still needs one of
    // the valid kinds, and `update` is the neutral fallback.
    const localOperationType =
      op.operationType === 'create' ||
      op.operationType === 'update' ||
      op.operationType === 'delete'
        ? op.operationType
        : 'update';

    await this.context
      .db()!
      .update(schema.operationLogs)
      .set({ conflictState: 'conflicted' })
      .where(eq(schema.operationLogs.id, op.id));
    await this.context.conflictService().recordConflict({
      storyId: this.context.storyId()!,
      entityType: op.entityType,
      entityId: op.entityId,
      reason: 'validation',
      localOperationType,
      localOperationIds: [op.id],
      localValues,
      serverValues: null,
      clientVersion: deriveBaseVersion(localValues) ?? null,
      serverVersion: null,
      message: unparseable ? `${reason} The stored payload could not be parsed.` : reason,
    });
  }

  /**
   * Local operations that can go to the server: not yet synchronized and with no pending conflict.
   * Excluding the conflicted ones is what stops the cycle from resending forever an operation the server
   * has already refused.
   */
  private async getPushableOperations(): Promise<OperationLogSelect[]> {
    return this.context.db()!.query.operationLogs.findMany({
      where: and(
        eq(schema.operationLogs.storyId, this.context.storyId()!),
        eq(schema.operationLogs.isSynced, false),
        isNull(schema.operationLogs.conflictState),
      ),
      // Ordered by operationVersion (strictly monotonic per story), not createdAt: the SQLite
      // timestamp column only has second precision, so two writes in the same second (e.g. a
      // Gallery create immediately followed by its GalleryRelation create) could tie under
      // createdAt and push in the wrong order, making the server reject the dependent create.
      // The id tiebreak keeps the order deterministic even if two rows ever share a version
      // (legacy imports), instead of pushing them in whatever order the query returns.
      orderBy: ({ operationVersion, id }) => [asc(operationVersion), asc(id)],
    });
  }

  /**
   * Every local operation of one entity the server has not accepted yet - pushable AND parked in a
   * pending conflict - in the order they were made. Read under the op-log lock by its callers, so
   * an edit recorded a moment ago is never missed by a decision about the same entity.
   */
  public async getUnsyncedOperationsForEntity(
    entityType: string,
    entityId: string,
  ): Promise<OperationLogSelect[]> {
    return this.context.db()!.query.operationLogs.findMany({
      where: and(
        eq(schema.operationLogs.storyId, this.context.storyId()!),
        eq(schema.operationLogs.entityType, entityType),
        eq(schema.operationLogs.entityId, entityId),
        eq(schema.operationLogs.isSynced, false),
      ),
      orderBy: ({ operationVersion, id }) => [asc(operationVersion), asc(id)],
    });
  }

  /**
   * Rewrites the base of the pending local operations to the version the entity holds now, chaining them
   * (the first rests on the new version, the second on the following one, and so on) so the server accepts
   * them in sequence.
   */
  public async rebasePendingOperations(
    pendingLocalOps: OperationLogSelect[],
    newEntityVersion?: number,
  ): Promise<void> {
    if (typeof newEntityVersion !== 'number') {
      return;
    }

    let base = newEntityVersion;
    let rebased = 0;
    for (const op of pendingLocalOps) {
      let payload: Record<string, any> | null = null;
      try {
        const parsed: unknown = JSON.parse(op.payload);
        if (parsed && typeof parsed === 'object') payload = parsed as Record<string, any>;
      } catch {
        payload = null;
      }
      if (!payload) {
        // A corrupted op cannot be rebased; the push quarantines it visibly instead. Skipping it
        // here - without advancing the chain, since it will never push - keeps one bad row from
        // aborting the rebase of every other op on the entity.
        console.warn(`Skipping rebase of local operation ${op.id}: payload cannot be parsed.`);
        continue;
      }
      // The engine derives the base as `payload.version - 1`, so we write base + 1.
      payload.version = base + 1;
      await this.context
        .db()!
        .update(schema.operationLogs)
        .set({ payload: JSON.stringify(payload) })
        .where(eq(schema.operationLogs.id, op.id));
      base += 1;
      rebased += 1;
    }

    // Restore the optimistic invariant (row version = last base + 1): the merge wrote the
    // server's version into the row, but the rebased operations will advance the server past
    // it on push. Without this the next edit bases itself on the stale version and conflicts
    // spuriously. All operations here belong to one entity, so the row follows the chain's
    // end (skipped ops excluded - they will never push); an entity this build does not store
    // has no row to advance.
    const first = pendingLocalOps[0];
    if (first) {
      const table = getEntityTable(first.entityType);
      if (table) {
        await this.context
          .db()!
          .update(table)
          .set({ version: newEntityVersion + rebased })
          .where(eq((table as any).id, first.entityId));
      }
    }
  }

  /**
   * Processes the push's response: it marks as synchronized only the operations the server accepted and
   * turns the refused ones into pending conflicts.
   *
   * Before, any 2xx response marked *every* operation as synchronized, so a refused operation was silently
   * discarded - the user's edit simply disappeared.
   */
  public async applyPushResult(
    result: SyncPushResult,
    pushedOperations: OperationLogSelect[],
    options: { silent?: boolean } = {},
  ): Promise<{ applied: number; conflicts: number }> {
    const notifier = this.context.notifier();

    if (!Array.isArray(result?.applied) && !Array.isArray(result?.conflicts)) {
      // A server predating per-operation results: all-or-nothing, versions assigned in batch
      // order. Stamping every op with the batch max would miss every echo (each op's real
      // version sits lower); counting back from the max restores the exact versions, since the
      // server bumps once per applied op. A concurrent interleaving may still shift one, but
      // that degrades to a bounded re-apply rather than missing every op of the batch.
      console.log(
        'SyncEngineService: server did not report per-operation results, assuming the whole batch was applied.',
      );
      const firstVersion = (result?.serverMaxOperationVersion || 0) - pushedOperations.length + 1;
      for (const [index, op] of pushedOperations.entries()) {
        await this.context
          .db()!
          .update(schema.operationLogs)
          .set({ isSynced: true, serverOperationVersion: firstVersion + index })
          .where(eq(schema.operationLogs.id, op.id));
      }
      entityEventEmitter.emit('operation_log_updated', this.context.storyId());
      return { applied: pushedOperations.length, conflicts: 0 };
    }

    const acceptedOperationIds = new Set<string>();
    for (const entry of result.applied || []) {
      if (!entry.clientOperationId) {
        continue;
      }
      acceptedOperationIds.add(entry.clientOperationId);
      await this.context
        .db()!
        .update(schema.operationLogs)
        .set({ isSynced: true, serverOperationVersion: entry.operationVersion })
        .where(eq(schema.operationLogs.id, entry.clientOperationId));
    }

    // An accepted operation moved its entity on the server; a conflict still pending on it must
    // know, or its resolution would align the row to a version the server has left.
    for (const entry of result.applied || []) {
      if (!entry.entity || !entry.entityId) continue;
      await raiseConflictsServerVersion(
        this.context.db()!,
        this.context.storyId()!,
        entry.entity,
        entry.entityId,
        entry.entityVersion,
      );
    }

    const pushedById = new Map(pushedOperations.map((op) => [op.id, op]));

    // Conflicts come per operation, but the decision is per entity: five refused edits on the same chapter
    // are one choice for the user, not five. The entity is read from the refused local operation when the
    // server echoed its id: a refusal of an envelope the server could not even parse may not name it.
    const conflictsByEntity = new Map<
      string,
      { entityType: string; entityId: string; group: SharedSyncConflict[] }
    >();
    for (const conflict of result.conflicts || []) {
      const refusedOp = conflict.clientOperationId
        ? pushedById.get(conflict.clientOperationId)
        : undefined;
      const entityType = refusedOp?.entityType ?? conflict.entity;
      const entityId = refusedOp?.entityId ?? conflict.entityId;
      const key = syncEntityKey(entityType, entityId);
      const bucket = conflictsByEntity.get(key);
      if (bucket) {
        bucket.group.push(conflict);
      } else {
        conflictsByEntity.set(key, { entityType, entityId, group: [conflict] });
      }
    }

    let autoMergedCount = 0;
    // Duplicates fold first, missing references last (`pushRefusals.ts`).
    const refusedEntities = inSettlingOrder([...conflictsByEntity.values()]);
    const rewrittenByFolds = new Set<string>();
    const waiting = waitingOperationIds(result.conflicts || []);
    // A route's path is one decision, never step by step (`routePaths.ts`).
    const routePaths = await withOpLogLock(this.context.storyId()!, () =>
      foldRoutePaths(this.context, refusedEntities, pushedOperations),
    );
    for (const { entityType, entityId, group } of refusedEntities) {
      if (routePaths.handled.has(syncEntityKey(entityType, entityId))) {
        autoMergedCount++;
        continue;
      }
      // Decided under the op-log lock against the entity's operations as they are NOW: the user may
      // have kept editing while the request was in flight, and those newer operations rest on the same
      // refused base - a merge must overlay and rebase them too, a conflict must hold them too.
      const merged = await withOpLogLock(this.context.storyId()!, async () => {
        const duplicate = group.find(isFoldableDuplicate);
        if (duplicate) {
          const relatedOps = (
            await this.getUnsyncedOperationsForEntity(entityType, entityId)
          ).filter((op) => op.conflictState === null);
          const rewritten = await foldIntoTwin(
            this.context,
            entityType,
            entityId,
            duplicate.serverEntity!,
            relatedOps,
            duplicate.ownEntity ?? null,
          );
          for (const id of rewritten) rewrittenByFolds.add(id);
          return true;
        }
        if (
          group.every(
            (conflict) =>
              !!conflict.clientOperationId && rewrittenByFolds.has(conflict.clientOperationId),
          )
        ) {
          return true;
        }
        // What it points at may be a create of this same push that did not land yet (refused and
        // folded, rewritten, skipped): it stays queued and is judged again once that one lands. A
        // reference truly gone is refused again with nothing left on its way, and asks then.
        if (
          onlyMissingReference(group) &&
          (await createStillOnItsWay(
            this.context.db()!,
            pushedOperations,
            entityType,
            entityId,
            waiting,
          ))
        ) {
          return true;
        }
        return this.settleRefusedEntity(entityType, entityId, group);
      });
      if (merged) autoMergedCount++;
    }

    entityEventEmitter.emit('operation_log_updated', this.context.storyId());

    const appliedCount = (result.applied || []).length;
    const realConflictCount = conflictsByEntity.size - autoMergedCount + routePaths.conflicts;
    if (appliedCount > 0) {
      console.log(
        `Successfully pushed ${appliedCount} operations for story ${this.context.storyId()}.`,
      );
      if (!options.silent) {
        notifier.pushedUpdates(appliedCount);
      }
    }
    if (realConflictCount > 0 && !options.silent) {
      notifier.conflictsDetected(realConflictCount);
    }
    return { applied: appliedCount, conflicts: realConflictCount };
  }

  /**
   * Turns the server's refusals of one entity into a silent merge (returns true) or a pending
   * conflict. Runs under the op-log lock (see `applyPushResult`).
   */
  private async settleRefusedEntity(
    entityType: string,
    entityId: string,
    group: SharedSyncConflict[],
  ): Promise<boolean> {
    const first = group[0]!;
    // Refused only because an earlier operation on the entity in the same batch was (the server
    // sends no snapshot then): nothing about the entity was judged, so there is nothing to decide.
    // The operations stay queued and go again once the earlier one settles. Recorded as a conflict,
    // the missing snapshot would read as "the server does not have it" and delete the entity here.
    if (group.every((conflict) => isBatchSkip(conflict))) return true;
    // Every *unaccepted* local operation for that entity goes into the decision, not only the one the
    // server cited: following ones rested on the refused base. Accepted operations were already marked
    // synchronized, so they never come back into a conflict (a row synced and conflicted at once would
    // leave the local log internally contradictory).
    const relatedOps = (await this.getUnsyncedOperationsForEntity(entityType, entityId)).filter(
      (op) => op.conflictState === null,
    );
    const localOperationType = relatedOps.some((op) => op.operationType === 'delete')
      ? 'delete'
      : relatedOps.some((op) => op.operationType === 'create')
        ? 'create'
        : 'update';
    const localValues =
      relatedOps.length > 0
        ? mergeLocalOperationPayloads(relatedOps)
        : first.attemptedChanges || {};

    // Only a move of a row the server deleted: the deletion loses nothing of it, so it is accepted
    // as it stands - asking where to put something gone decides nothing.
    if (
      first.reason === 'deleted_on_server' &&
      localOperationType === 'update' &&
      relatedOps.length > 0 &&
      onlyMoves(entityType, localValues)
    ) {
      await this.context
        .db()!
        .update(schema.operationLogs)
        .set({ conflictState: 'abandoned', isSynced: true })
        .where(
          inArray(
            schema.operationLogs.id,
            relatedOps.map((op) => op.id),
          ),
        );
      const table = getEntityTable(entityType);
      if (table) {
        const tombstone = toEntityColumns(
          entityType,
          withoutDerivedPosition(entityType, first.serverEntity ?? {}),
        );
        await this.context
          .db()!
          .update(table)
          .set({
            ...tombstone,
            isDeleted: true,
            ...(typeof first.serverVersion === 'number' ? { version: first.serverVersion } : {}),
          } as never)
          .where(eq((table as any).id, entityId));
      }
      return true;
    }

    // `version_conflict` only says the base that was read went stale, not that both sides changed the same
    // fields - `checkVersionConflict` on the server compares only the version number (see
    // `BaseSyncEntityHandler.ts`). If no field is genuinely disputed, merging silently and rebasing the
    // pending operation is the same thing `reconcileRemoteUpdate` already does on the pull path; without
    // this, editing different fields of the same character in two places always became a decision for the
    // user, with nothing to decide. Restricted to an `update` with the entity still alive on the server - a
    // deleted entity arrives with `reason: 'deleted_on_server'`, never `'version_conflict'` (checked
    // earlier, in `BaseSyncEntityHandler.update()` itself), so this never merges over a deletion.
    //
    // Important: `contestedFields` here must NOT come from `findContestedFields(localValues,
    // first.serverEntity)` as on the pull path. There, `remoteValues` is only the delta of ONE specific
    // remote operation, so comparing against `localValues` correctly answers "did the server change this
    // field too?". Here `first.serverEntity` is the whole current row - the value of a field the client
    // itself is editing always "looks" different from the new value, whether the server touched it or not,
    // which would make every edited field look disputed. `first.changedFields` (populated by the server
    // from its own operation history - see `SyncService.getChangedFieldsSinceVersion`) is the real delta:
    // the fields that changed *since the version the client read*. Without it (an old server, a response
    // without that field), there is no way to prove there is no real dispute - the safe move is not to
    // merge, and to leave it as a conflict as usual.
    //
    // Before any of that: a client already holding the operation that last wrote the entity has seen
    // every change to its fields - the base is behind only in version bookkeeping (see
    // `entityOperationVersion`), so nothing is contested and a deletion rebases just the same.
    const seenEveryChange =
      first.reason === 'version_conflict' &&
      typeof first.entityOperationVersion === 'number' &&
      localOperationType !== 'create' &&
      (await this.lastServerOperationOf(entityType, entityId)) >= first.entityOperationVersion;
    if (
      first.reason === 'version_conflict' &&
      first.serverEntity &&
      (seenEveryChange || (localOperationType === 'update' && first.changedFields))
    ) {
      // A field is only genuinely disputed if (a) somebody else touched it since the client's base AND (b)
      // the value the client wants to write really does differ from what is there now - the second part is
      // what was missing: taking "changedFields" alone reconflicts whenever the final value coincides by
      // chance (both sides renaming to the same text, say), even with nothing actually to decide.
      // `findContestedFields` already does the tolerant value comparison the rest of the system uses.
      // A place is never disputed: this device's rank lands after the other and the last move pushed
      // is the row's place everywhere.
      const contestedFields = seenEveryChange
        ? []
        : findContestedFields(localValues, first.serverEntity).filter(
            (field) => field !== 'rank' && first.changedFields!.includes(field),
          );
      if (contestedFields.length === 0) {
        // Every field merges: the local edits are overlaid on the server's row. Writing the bare
        // server row would clobber them in the local copy (the server's stale values winning
        // visually) while the pending operation still carries them to the server, leaving the
        // row and the server diverged after the push succeeds. The derived position is never
        // written - it follows the rank.
        const table = getEntityTable(entityType);
        if (table) {
          const columns = toEntityColumns(
            entityType,
            withoutDerivedPosition(entityType, { ...first.serverEntity, ...localValues }),
          );
          if (Object.keys(columns).length > 0) {
            await this.context
              .db()!
              .update(table)
              .set(columns)
              .where(eq((table as any).id, entityId));
          }
        }
        await this.rebasePendingOperations(relatedOps, first.serverVersion);
        return true;
      }
    }

    await this.context.conflictService().recordConflict({
      storyId: this.context.storyId()!,
      entityType,
      entityId,
      reason: first.reason,
      localOperationType,
      localOperationIds: relatedOps.map((op) => op.id),
      localValues,
      serverValues: first.serverEntity
        ? withoutDerivedPosition(entityType, first.serverEntity)
        : null,
      clientVersion: first.clientVersion ?? null,
      serverVersion: first.serverVersion ?? null,
      message: group.map((conflict) => conflict.message).join(' | '),
    });
    return false;
  }

  /** The latest server operation on the entity this device holds - pulled, or its own acked. */
  private async lastServerOperationOf(entityType: string, entityId: string): Promise<number> {
    const rows = await this.context
      .db()!
      .select({ last: max(schema.operationLogs.serverOperationVersion) })
      .from(schema.operationLogs)
      .where(
        and(
          eq(schema.operationLogs.storyId, this.context.storyId()!),
          eq(schema.operationLogs.entityType, entityType),
          eq(schema.operationLogs.entityId, entityId),
          eq(schema.operationLogs.isSynced, true),
        ),
      );
    return rows[0]?.last ?? 0;
  }
}

/** A refusal passing no judgement on the entity: skipped behind an earlier refusal in the batch. */
function isBatchSkip(conflict: SharedSyncConflict): boolean {
  return (
    conflict.reason === 'version_conflict' &&
    !conflict.serverEntity &&
    typeof conflict.serverVersion !== 'number'
  );
}
