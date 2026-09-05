import type {
  ChapterReorderingStoryUpdate,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  StoryReorderingStoryUpdate,
  StoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import type { OperationLogSelect } from '../../db/schema';
import { createULID } from '../../utils/entityUtils';
import type { ClientSyncEntityHandler } from '../entity-sync-handlers/ClientSyncEntityHandler';
import {
  applyReorderToLocalDb,
  findContestedFields,
  mergeLocalOperationPayloads,
} from '../SyncConflictService';
import type { SyncContext } from './SyncContext';
import { deriveBaseVersion } from './syncPure';

interface SyncPullOptions {
  context: SyncContext;
  rebasePendingOperations: (
    operations: OperationLogSelect[],
    newEntityVersion?: number,
  ) => Promise<void>;
}

/** Applies remote operations while preserving and surfacing unsent local edits. */
export class SyncPull {
  private readonly context: SyncContext;
  private readonly rebasePendingOperations: SyncPullOptions['rebasePendingOperations'];

  public constructor(options: SyncPullOptions) {
    this.context = options.context;
    this.rebasePendingOperations = options.rebasePendingOperations;
  }

  public async isOwnEchoedOperation(update: StoryUpdate): Promise<boolean> {
    if (!update.operationVersion) {
      return false;
    }
    const existing = await this.context.db()!.query.operationLogs.findFirst({
      where: and(
        eq(schema.operationLogs.storyId, this.context.storyId()!),
        eq(schema.operationLogs.serverOperationVersion, update.operationVersion),
        eq(schema.operationLogs.isSynced, true),
      ),
      columns: { id: true },
    });
    return !!existing;
  }

  /**
   * Applies a remote create tolerating that the entity may already exist.
   *
   * A raw `insert` would fail when repeating the operation (for instance if an earlier push's response
   * was lost and the server returned the create in the next pull), and the failure was counted as "error
   * applying a remote update" without anything actually having gone wrong.
   */
  public async applyRemoteCreate(
    update: StoryUpdate,
    handler: ClientSyncEntityHandler,
  ): Promise<void> {
    const createUpdate = update as CreateStoryUpdate;
    const existing = update.id ? await handler.getById(update.id) : undefined;

    if (!existing) {
      await handler.applyCreate(this.context.storyId()!, createUpdate);
      return;
    }

    await handler.applyUpdate(this.context.storyId()!, {
      ...createUpdate,
      type: 'update',
      id: update.id!,
      changes: {
        ...createUpdate.data,
        version:
          typeof createUpdate.data?.version === 'number'
            ? createUpdate.data.version
            : (createUpdate.version ?? 0),
      },
    } as UpdateStoryUpdate);
  }

  /**
   * Records an operation coming from the server in the local log.
   *
   * The id used is the operation's id *on the server*. It used to be the entity's id, which made the
   * second operation on the same entity collide on the primary key - the failure was swallowed and
   * reported to the user as "failed to apply remote updates".
   */
  public async recordRemoteOperationLocally(update: StoryUpdate): Promise<void> {
    const payloadToStore =
      update.type === 'create'
        ? update.data
        : update.type === 'update'
          ? update.changes
          : update.type === 'reorder'
            ? {
                reorderItems: update.reorderItems,
                ...(update.entity === 'Story'
                  ? {
                      reorderTarget: (update as StoryReorderingStoryUpdate).reorderTarget,
                      schemaEntityType: (update as StoryReorderingStoryUpdate).schemaEntityType,
                    }
                  : {}),
              }
            : { id: update.id }; // For delete, just store the ID

    await this.context
      .db()!
      .insert(schema.operationLogs)
      .values({
        id: update.operationId || createULID(),
        storyId: this.context.storyId()!,
        userId: update.originatingUser || 'unknown',
        operationVersion: update.operationVersion || 0,
        operationType: update.type,
        entityType: update.entity,
        entityId: update.id!,
        payload: JSON.stringify(payloadToStore),
        createdAt: update.operationTime ? new Date(update.operationTime) : new Date(),
        isSynced: true, // Mark as synced because it came from the server
        serverOperationVersion: update.operationVersion || 0,
      })
      .onConflictDoNothing();
  }

  /**
   * Reconciles a remote update with local edits on the same entity that have not been accepted yet.
   *
   * The rule is to preserve what the person did: fields only the server changed are applied, fields the
   * person also changed keep their value and become a conflict for them to decide. Before, the remote
   * update was written on top and the offline edit disappeared with no warning.
   */
  public async reconcileRemoteUpdate(
    update: StoryUpdate,
    pendingLocalOps: OperationLogSelect[],
    handler: ClientSyncEntityHandler,
  ): Promise<{ conflicted: boolean }> {
    const entityId = update.id!;

    // Reorder does not fit the rest of this function: the disputed value is the whole order
    // (`reorderItems`), not an entity's scalar fields - `mergeLocalOperationPayloads`/`findContestedFields`
    // make no sense for it.
    if (update.type === 'reorder') {
      return this.reconcileRemoteReorder(
        update as ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate,
        entityId,
        pendingLocalOps,
      );
    }

    const localWantsDelete = pendingLocalOps.some((op) => op.operationType === 'delete');
    const localValues = mergeLocalOperationPayloads(pendingLocalOps);
    const localOperationIds = pendingLocalOps.map((op) => op.id);
    const localOperationType = localWantsDelete
      ? 'delete'
      : pendingLocalOps.some((op) => op.operationType === 'create')
        ? 'create'
        : 'update';

    const recordConflict = (
      reason: 'deleted_on_server' | 'edited_on_server' | 'concurrent_edit',
      serverValues: Record<string, any> | null,
    ) =>
      this.context.conflictService().recordConflict({
        storyId: this.context.storyId()!,
        entityType: update.entity,
        entityId,
        reason,
        localOperationType,
        localOperationIds,
        localValues,
        serverValues,
        clientVersion: deriveBaseVersion(JSON.parse(pendingLocalOps[0].payload)) ?? null,
        serverVersion: update.version ?? null,
        message:
          update.type === 'delete'
            ? `Server deleted ${update.entity} ${entityId} while it had unsynced local edits.`
            : `Server and local changes overlap on ${update.entity} ${entityId}.`,
      });

    if (update.type === 'delete') {
      if (localWantsDelete) {
        // Both sides deleted: the same intent, nothing to decide.
        await handler.applyDelete(this.context.storyId()!, update as DeleteStoryUpdate);
        return { conflicted: false };
      }
      // The remote deletion is deliberately not applied: discarding what the person wrote here would take
      // away their chance to recover the entity.
      await recordConflict('deleted_on_server', { isDeleted: true, version: update.version });
      return { conflicted: true };
    }

    const remoteValues: Record<string, any> =
      update.type === 'create'
        ? { ...(update as CreateStoryUpdate).data }
        : update.type === 'update'
          ? { ...(update as UpdateStoryUpdate).changes }
          : {};

    if (localWantsDelete) {
      await recordConflict('edited_on_server', remoteValues);
      return { conflicted: true };
    }

    const contestedFields = findContestedFields(localValues, remoteValues);
    const mergeableEntries = Object.entries(remoteValues).filter(
      ([key]) => !contestedFields.includes(key),
    );

    if (mergeableEntries.length > 0) {
      await handler.applyUpdate(this.context.storyId()!, {
        ...update,
        type: 'update',
        id: entityId,
        changes: Object.fromEntries(mergeableEntries),
      } as UpdateStoryUpdate);
    }

    if (contestedFields.length === 0) {
      // The two edits fit together. The local one only has to be rebased onto the new version, and then it
      // goes through on the next push without bothering the user with a decision.
      await this.rebasePendingOperations(pendingLocalOps, update.version);
      return { conflicted: false };
    }

    await recordConflict('concurrent_edit', remoteValues);
    return { conflicted: true };
  }

  /**
   * The counterpart of `reconcileRemoteUpdate` for reorder alone - extracted separately because the
   * disputed value (`reorderItems`) is not a set of one entity's fields, it is the whole order of N other
   * rows (a Chapter's Scenes, or a Story's Chapters).
   */
  private async reconcileRemoteReorder(
    update: ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate,
    entityId: string,
    pendingLocalOps: OperationLogSelect[],
  ): Promise<{ conflicted: boolean }> {
    const localReorderOp = pendingLocalOps.find((op) => op.operationType === 'reorder');

    if (!localReorderOp) {
      // What is pending on this entity is of another kind (renaming a chapter, say) - it does not conflict
      // with the order coming from the server, which can be applied directly.
      await applyReorderToLocalDb(this.context.db()!, update, new Date(update.operationTime!));
      return { conflicted: false };
    }

    const localPayload = JSON.parse(localReorderOp.payload);
    await this.context.conflictService().recordConflict({
      storyId: this.context.storyId()!,
      entityType: update.entity,
      entityId,
      reason: 'concurrent_edit',
      localOperationType: 'reorder',
      localOperationIds: [localReorderOp.id],
      localValues: { reorderItems: localPayload.reorderItems ?? [] },
      serverValues: {
        reorderItems: update.reorderItems,
        reorderTarget: (update as StoryReorderingStoryUpdate).reorderTarget,
      },
      clientVersion: deriveBaseVersion(localPayload) ?? null,
      serverVersion: update.version ?? null,
      message: `Server and local changes overlap on ordering ${update.entity} ${entityId}.`,
    });
    return { conflicted: true };
  }

  /**
   * Rewrites the base of the pending local operations to the version the entity holds now, chaining them
   * (the first rests on the new version, the second on the following one, and so on) so the server accepts
   * them in sequence.
   */
}
