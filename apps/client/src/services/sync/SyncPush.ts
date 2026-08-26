import type {
  ChapterReorderingStoryUpdate,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  StoryReorderingStoryUpdate,
  StoryUpdate,
  SyncConflict as SharedSyncConflict,
  SyncPushResult,
  UpdateStoryUpdate,
} from '@keres/shared';
import { MAX_SYNC_BATCH_SIZE } from '@keres/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { OperationLogSelect } from '../../db/schema';
import { useNotificationStore } from '../../state/notificationStore';
import { entityEventEmitter } from '../../utils/EventEmitter';
import i18n from '../../utils/i18n';
import { getEntityTable, toEntityColumns } from '../entityTableRegistry';
import { findContestedFields, mergeLocalOperationPayloads } from '../SyncConflictService';
import type { SyncContext } from './SyncContext';
import { deriveBaseVersion, syncEntityKey } from './syncPure';

/** Builds and pushes local batches, then records the server's per-operation result. */
export class SyncPush {
  public constructor(private readonly context: SyncContext) {}

  public async pushPendingOperations(): Promise<{ offline: boolean }> {
    const { showNotification } = useNotificationStore.getState();
    let totalApplied = 0;
    let totalConflicts = 0;

    for (let chunk = 0; chunk < 50; chunk += 1) {
      const pending = await this.getPushableOperations();
      const mapped: { op: OperationLogSelect; update: StoryUpdate }[] = [];
      for (const op of pending) {
        const update = this.buildStoryUpdateFromLocalOp(op);
        if (update) mapped.push({ op, update });
      }
      const prepared = mapped.slice(0, MAX_SYNC_BATCH_SIZE);
      if (prepared.length === 0) break;

      if (chunk === 0) {
        console.log(`Pushing local operations for story ${this.context.storyId()} to server...`);
      }

      const pushResponse = await this.context.client().post<SyncPushResult>(
        `/sync/${this.context.storyId()}`,
        prepared.map((entry) => entry.update),
      );
      const summary = await this.applyPushResult(
        pushResponse.data,
        prepared.map((entry) => entry.op),
        { silent: true },
      );
      totalApplied += summary.applied;
      totalConflicts += summary.conflicts;

      const remaining = await this.getPushableOperations();
      if (remaining.length >= pending.length) {
        break;
      }
    }

    if (totalApplied > 0) {
      showNotification(i18n.t('sync_pushed_updates', { count: totalApplied }), 'success');
    }
    if (totalConflicts > 0) {
      showNotification(i18n.t('sync_conflicts_detected', { count: totalConflicts }), 'warning');
    }
    return { offline: false };
  }

  private buildStoryUpdateFromLocalOp(op: OperationLogSelect): StoryUpdate | null {
    const payloadData = JSON.parse(op.payload);
    const baseVersion = deriveBaseVersion(payloadData);

    if (op.operationType === 'update' && typeof baseVersion !== 'number') {
      console.warn(
        `Skipping update ${op.entityType} ${op.entityId}: payload has no version, server would 422 the whole batch.`,
      );
      return null;
    }
    if (op.operationType === 'create' && !op.entityId) {
      console.warn(`Skipping create of ${op.entityType}: missing entity id.`);
      return null;
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
          ...baseUpdate,
          type: 'create',
          data: filteredPayloadData,
        } as CreateStoryUpdate;
      case 'update':
        return {
          ...baseUpdate,
          type: 'update',
          changes: {
            ...filteredPayloadData,
            version: baseVersion,
          },
        } as UpdateStoryUpdate;
      case 'delete':
        return {
          ...baseUpdate,
          type: 'delete',
        } as DeleteStoryUpdate;
      case 'reorder':
        if (op.entityType === 'Chapter' && Array.isArray(filteredPayloadData.reorderItems)) {
          return {
            ...baseUpdate,
            type: 'reorder',
            entity: 'Chapter',
            reorderItems: filteredPayloadData.reorderItems.map((item: any) => ({
              ...item,
            })),
          } as ChapterReorderingStoryUpdate;
        }
        if (op.entityType === 'Story' && Array.isArray(filteredPayloadData.reorderItems)) {
          return {
            ...baseUpdate,
            type: 'reorder',
            entity: 'Story',
            reorderItems: filteredPayloadData.reorderItems.map((item: any) => ({
              ...item,
            })),
            reorderTarget: filteredPayloadData.reorderTarget,
            schemaEntityType: filteredPayloadData.schemaEntityType,
          } as StoryReorderingStoryUpdate;
        }
        console.warn(
          `Unhandled reorder operation type or entity: ${op.entityType}, ${op.operationType}`,
        );
        return null;
      default:
        console.warn(`Unhandled operation type: ${op.operationType}`);
        return null;
    }
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
      orderBy: ({ operationVersion }) => [asc(operationVersion)],
    });
  }

  /** Pending local operations grouped by entity, to cross-reference with what comes from the pull. */
  public async getPendingOperationsByEntity(): Promise<Map<string, OperationLogSelect[]>> {
    const pending = await this.getPushableOperations();
    const byEntity = new Map<string, OperationLogSelect[]>();
    for (const op of pending) {
      const key = syncEntityKey(op.entityType, op.entityId);
      const bucket = byEntity.get(key);
      if (bucket) {
        bucket.push(op);
      } else {
        byEntity.set(key, [op]);
      }
    }
    return byEntity;
  }

  /**
   * Is the operation that came from the pull already recorded locally?
   *
   * It covers two cases: operations this client pushed and the server is handing back, and remote
   * operations an earlier pull already applied. In both, reapplying is unnecessary and would duplicate the
   * row in the local log.
   */
  public async rebasePendingOperations(
    pendingLocalOps: OperationLogSelect[],
    newEntityVersion?: number,
  ): Promise<void> {
    if (typeof newEntityVersion !== 'number') {
      return;
    }

    let base = newEntityVersion;
    for (const op of pendingLocalOps) {
      const payload = JSON.parse(op.payload);
      // The engine derives the base as `payload.version - 1`, so we write base + 1.
      payload.version = base + 1;
      await this.context
        .db()!
        .update(schema.operationLogs)
        .set({ payload: JSON.stringify(payload) })
        .where(eq(schema.operationLogs.id, op.id));
      base += 1;
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
    const { showNotification } = useNotificationStore.getState();

    if (!Array.isArray(result?.applied) && !Array.isArray(result?.conflicts)) {
      // A server predating this change: there is no per-operation result to inspect. We keep the old
      // behaviour rather than stop synchronizing with it.
      console.log(
        'SyncEngineService: server did not report per-operation results, assuming the whole batch was applied.',
      );
      for (const op of pushedOperations) {
        await this.context
          .db()!
          .update(schema.operationLogs)
          .set({ isSynced: true, serverOperationVersion: result?.serverMaxOperationVersion || 0 })
          .where(eq(schema.operationLogs.id, op.id));
      }
      entityEventEmitter.emit('operation_log_updated', this.context.storyId());
      return { applied: pushedOperations.length, conflicts: 0 };
    }

    for (const entry of result.applied || []) {
      if (!entry.clientOperationId) {
        continue;
      }
      await this.context
        .db()!
        .update(schema.operationLogs)
        .set({ isSynced: true, serverOperationVersion: entry.operationVersion })
        .where(eq(schema.operationLogs.id, entry.clientOperationId));
    }

    // Conflicts come per operation, but the decision is per entity: five refused edits on the same chapter
    // are one choice for the user, not five.
    const conflictsByEntity = new Map<string, SharedSyncConflict[]>();
    for (const conflict of result.conflicts || []) {
      const key = syncEntityKey(conflict.entity, conflict.entityId);
      const bucket = conflictsByEntity.get(key);
      if (bucket) {
        bucket.push(conflict);
      } else {
        conflictsByEntity.set(key, [conflict]);
      }
    }

    let autoMergedCount = 0;
    for (const [key, group] of conflictsByEntity) {
      const first = group[0];
      // Every local operation for that entity goes into the conflict, not only the one the server cited: the
      // following ones rested on the refused base.
      const relatedOps = pushedOperations.filter(
        (op) => syncEntityKey(op.entityType, op.entityId) === key,
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
      if (
        first.reason === 'version_conflict' &&
        localOperationType === 'update' &&
        first.serverEntity &&
        first.changedFields
      ) {
        // A field is only genuinely disputed if (a) somebody else touched it since the client's base AND (b)
        // the value the client wants to write really does differ from what is there now - the second part is
        // what was missing: taking "changedFields" alone reconflicts whenever the final value coincides by
        // chance (both sides renaming to the same text, say), even with nothing actually to decide.
        // `findContestedFields` already does the tolerant value comparison the rest of the system uses.
        const contestedFields = findContestedFields(localValues, first.serverEntity).filter(
          (field) => first.changedFields!.includes(field),
        );
        if (contestedFields.length === 0) {
          const mergeableValues: Record<string, any> = {};
          for (const [field, value] of Object.entries(first.serverEntity)) {
            if (!contestedFields.includes(field)) {
              mergeableValues[field] = value;
            }
          }
          const table = getEntityTable(first.entity);
          if (table) {
            const columns = toEntityColumns(first.entity, mergeableValues);
            if (Object.keys(columns).length > 0) {
              await this.context
                .db()!
                .update(table)
                .set(columns)
                .where(eq((table as any).id, first.entityId));
            }
          }
          await this.rebasePendingOperations(relatedOps, first.serverVersion);
          autoMergedCount++;
          continue;
        }
      }

      await this.context.conflictService().recordConflict({
        storyId: this.context.storyId()!,
        entityType: first.entity,
        entityId: first.entityId,
        reason: first.reason,
        localOperationType,
        localOperationIds: relatedOps.map((op) => op.id),
        localValues,
        serverValues: first.serverEntity ?? null,
        clientVersion: first.clientVersion ?? null,
        serverVersion: first.serverVersion ?? null,
        message: group.map((conflict) => conflict.message).join(' | '),
      });
    }

    entityEventEmitter.emit('operation_log_updated', this.context.storyId());

    const appliedCount = (result.applied || []).length;
    const realConflictCount = conflictsByEntity.size - autoMergedCount;
    if (appliedCount > 0) {
      console.log(
        `Successfully pushed ${appliedCount} operations for story ${this.context.storyId()}.`,
      );
      if (!options.silent) {
        showNotification(i18n.t('sync_pushed_updates', { count: appliedCount }), 'success');
      }
    }
    if (realConflictCount > 0 && !options.silent) {
      showNotification(i18n.t('sync_conflicts_detected', { count: realConflictCount }), 'warning');
    }
    return { applied: appliedCount, conflicts: realConflictCount };
  }
}
