import type {
  ChapterReorderingStoryUpdate,
  StoryReorderingStoryUpdate,
  SyncConflictReason,
} from '@keres/shared';
import { findContestedFields, syncConflictValuesDiffer, validateBoardContent } from '@keres/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import type { SyncConflictSelect } from '../db/schema';
import { createULID } from '../utils/entityUtils';
import { entityEventEmitter } from '../utils/EventEmitter';
import { getEntityTable, toEntityColumns } from './entityTableRegistry';
import { createBoardService } from './storymanagement/BoardService';

export type ConflictResolution = 'keep_local' | 'keep_server' | 'merge' | 'restore' | 'discard';

/** A conflict with the JSONs already unpacked, as the screen consumes it. */
export interface PendingConflict {
  id: string;
  storyId: string;
  entityType: string;
  entityId: string;
  reason: SyncConflictReason;
  localOperationType: 'create' | 'update' | 'delete' | 'reorder';
  localOperationIds: string[];
  /** Fields the user changed that have not been accepted by the server yet. */
  localValues: Record<string, any>;
  /** The entity's state on the server. `null` when it no longer exists there. */
  serverValues: Record<string, any> | null;
  clientVersion: number | null;
  serverVersion: number | null;
  message: string | null;
  detectedAt: Date;
  /** Fields where the two sides diverge - what the screen asks the user to decide. */
  contestedFields: string[];
  /** The entity was deleted on the server but the user carried on editing. */
  isDeletedOnServer: boolean;
  /** The user deleted locally something the server carried on editing. */
  isLocalDelete: boolean;
}

export interface RecordConflictInput {
  storyId: string;
  entityType: string;
  entityId: string;
  reason: SyncConflictReason;
  localOperationType: 'create' | 'update' | 'delete' | 'reorder';
  localOperationIds: string[];
  localValues: Record<string, any>;
  serverValues?: Record<string, any> | null;
  clientVersion?: number | null;
  serverVersion?: number | null;
  message?: string | null;
}

export interface SyncConflictService {
  recordConflict(input: RecordConflictInput): Promise<void>;
  getPendingConflicts(storyId?: string): Promise<PendingConflict[]>;
  countPendingConflicts(storyId?: string): Promise<number>;
  /** Preserves the user's work, rebased onto the server's current version. */
  resolveKeepLocal(conflictId: string, chosenValues?: Record<string, any>): Promise<void>;
  /** Accepts what the server has and discards the pending local operations. */
  resolveKeepServer(conflictId: string): Promise<void>;
  /**
   * Saves the local Board drawing as a new board, then accepts the server's on the original.
   * The create happens first: if it fails, the local work is still there.
   */
  resolveKeepServerAndCloneBoard(
    conflictId: string,
    currentUserId: string,
    cloneName: string,
  ): Promise<void>;
  /**
   * Gets the conflict out of the way without resolving it: the local operations are abandoned
   * (not left blocked - there would be no way back to them), and the row reverts to the
   * server's copy so it stops showing values that will never sync.
   */
  dismissConflict(conflictId: string): Promise<void>;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export { findContestedFields, mergeLocalOperationPayloads } from '@keres/shared';

/**
 * Applies a remote reorder (or the server's version of one that conflicted) to the local database. It
 * lives here, and not in `SyncEngineService`, because `resolveKeepServer` also needs it for the reorder
 * case - and this file must not depend back on `SyncEngineService`, which already depends on this one
 * (see `conflictService` there).
 */
export async function applyReorderToLocalDb(
  db: AppDrizzleClient,
  update: ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate,
  operationTime: Date,
  options?: { bumpVersions?: boolean },
): Promise<void> {
  const { reorderItems } = update;
  if (!reorderItems || reorderItems.length === 0) return;
  // Resolving keep-server re-applies the arrangement over rows the abandoned local op already
  // bumped: bumping again would count the speculation twice, so the resolution applies the
  // order without touching versions and aligns the container separately instead.
  const bumpVersions = options?.bumpVersions !== false;

  if (update.entity === 'Story') {
    const target = (update as StoryReorderingStoryUpdate).reorderTarget;
    if (
      target !== undefined &&
      target !== 'Event' &&
      target !== 'StorySchemaField' &&
      target !== 'Stat'
    ) {
      // A target this build does not reorder (a newer server's collection): the chapters
      // branch below matches no rows by id, so this degrades to a no-op rather than
      // corrupting anything - but it is worth one line in the log.
      console.warn(
        `applyReorderToLocalDb: unrecognised reorder target '${target}', skipping items.`,
      );
    }
  }

  await db.transaction(async (tx) => {
    for (const item of reorderItems) {
      if (update.entity === 'Chapter') {
        // Reordering scenes within a chapter
        await tx
          .update(schema.scenes)
          .set({
            index: item.newIndex,
            updatedAt: operationTime,
            version: bumpVersions ? sql`${schema.scenes.version} + 1` : undefined,
          })
          .where(eq(schema.scenes.id, item.id));
      } else if (
        update.entity === 'Story' &&
        (update as StoryReorderingStoryUpdate).reorderTarget === 'StorySchemaField'
      ) {
        await tx
          .update(schema.storySchemaFields)
          .set({
            order: item.newIndex - 1,
            updatedAt: operationTime,
            version: bumpVersions ? sql`${schema.storySchemaFields.version} + 1` : undefined,
          })
          .where(eq(schema.storySchemaFields.id, item.id));
      } else if (
        update.entity === 'Story' &&
        (update as StoryReorderingStoryUpdate).reorderTarget === 'Stat'
      ) {
        await tx
          .update(schema.stats)
          .set({
            order: item.newIndex - 1,
            updatedAt: operationTime,
            version: bumpVersions ? sql`${schema.stats.version} + 1` : undefined,
          })
          .where(eq(schema.stats.id, item.id));
      } else if (update.entity === 'Story') {
        // Reordering chapters (or events, which share their table) within a story
        await tx
          .update(schema.chapters)
          .set({
            index: item.newIndex,
            updatedAt: operationTime,
            version: bumpVersions ? sql`${schema.chapters.version} + 1` : undefined,
          })
          .where(eq(schema.chapters.id, item.id));
      }
    }

    // The container bumps with its rows: the server bumps it once per applied reorder, so an
    // applier that skips this would base its next container edit on a stale version.
    if (bumpVersions && update.id) {
      if (update.entity === 'Chapter') {
        await tx
          .update(schema.chapters)
          .set({
            updatedAt: operationTime,
            version: sql`${schema.chapters.version} + 1`,
          })
          .where(eq(schema.chapters.id, update.id));
      } else if (update.entity === 'Story') {
        await tx
          .update(schema.stories)
          .set({
            updatedAt: operationTime,
            version: sql`${schema.stories.version} + 1`,
          })
          .where(eq(schema.stories.id, update.id));
      }
    }
  });
}

/** Any local table holding a syncable entity. */
type SyncTable = Exclude<ReturnType<typeof getEntityTable>, undefined>;

/**
 * Which table a reorder's items live in - the same dispatch as `applyReorderToLocalDb`.
 * Needed separately because `resolveKeepLocal` anticipates versions on those rows without
 * moving any indices.
 */
function reorderItemTable(entityType: string, reorderTarget: unknown): SyncTable | undefined {
  if (entityType === 'Chapter') return schema.scenes;
  if (entityType === 'Story' && reorderTarget === 'StorySchemaField') {
    return schema.storySchemaFields;
  }
  if (entityType === 'Story' && reorderTarget === 'Stat') return schema.stats;
  if (entityType === 'Story') return schema.chapters;
  return undefined;
}

export const createSyncConflictService = (db: AppDrizzleClient): SyncConflictService => {
  const toPendingConflict = (row: SyncConflictSelect): PendingConflict => {
    const localValues = parseJson<Record<string, any>>(row.localValues, {});
    const serverValues = parseJson<Record<string, any> | null>(row.serverValues, null);

    return {
      id: row.id,
      storyId: row.storyId,
      entityType: row.entityType,
      entityId: row.entityId,
      reason: row.reason as SyncConflictReason,
      localOperationType: row.localOperationType,
      localOperationIds: parseJson<string[]>(row.localOperationIds, []),
      localValues,
      serverValues,
      clientVersion: row.clientVersion,
      serverVersion: row.serverVersion,
      message: row.message,
      detectedAt: row.detectedAt,
      // A reorder has no "fields" in the sense the rest of the conflict machinery understands - the disputed
      // value is the whole order (`reorderItems`), not something to compare item by item. Forcing it empty
      // here makes the screen fall back to the binary choice (keep my order / use the server's) instead of
      // trying to build a field picker with raw JSON inside.
      contestedFields:
        row.localOperationType === 'reorder' ? [] : findContestedFields(localValues, serverValues),
      isDeletedOnServer: row.reason === 'deleted_on_server' || !!serverValues?.isDeleted,
      isLocalDelete: row.localOperationType === 'delete',
    };
  };

  /**
   * Marks the conflict's local operations so the synchronization engine does not resend them. Without
   * this the cycle would try to push the same refused operation every 30 seconds, producing a new conflict
   * on every round.
   */
  const blockOperations = async (operationIds: string[]) => {
    if (operationIds.length === 0) return;
    await db
      .update(schema.operationLogs)
      .set({ conflictState: 'conflicted' })
      .where(inArray(schema.operationLogs.id, operationIds));
  };

  const abandonOperations = async (operationIds: string[]) => {
    if (operationIds.length === 0) return;
    await db
      .update(schema.operationLogs)
      .set({ conflictState: 'abandoned', isSynced: true })
      .where(inArray(schema.operationLogs.id, operationIds));
  };

  const getConflict = async (conflictId: string): Promise<PendingConflict | undefined> => {
    const row = await db.query.syncConflicts.findFirst({
      where: eq(schema.syncConflicts.id, conflictId),
    });
    return row ? toPendingConflict(row) : undefined;
  };

  const closeConflict = async (conflictId: string, resolution: ConflictResolution) => {
    await db
      .update(schema.syncConflicts)
      .set({ status: 'resolved', resolution, resolvedAt: new Date() })
      .where(eq(schema.syncConflicts.id, conflictId));
  };

  /**
   * Records a new, already-rebased local operation: the payload carries `version = base + 1`, which is
   * the convention the synchronization engine uses to derive the base sent to the server. Rebasing is
   * what makes "keep mine" work - the edit is resent resting on the version the server holds *now*, so it
   * passes the concurrency check instead of conflicting again.
   */
  const recordRebasedOperation = async (
    conflict: PendingConflict,
    operationType: 'create' | 'update' | 'delete',
    values: Record<string, any>,
    baseVersion: number,
  ) => {
    const story = await db.query.stories.findFirst({
      where: eq(schema.stories.id, conflict.storyId),
      columns: { lastOperationLog: true, userId: true },
    });
    const nextOperationVersion = (story?.lastOperationLog || 0) + 1;

    await db.insert(schema.operationLogs).values({
      id: createULID(),
      storyId: conflict.storyId,
      userId: story?.userId || 'local_user',
      operationVersion: nextOperationVersion,
      operationType,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      payload: JSON.stringify({ ...values, version: baseVersion + 1 }),
      createdAt: new Date(),
      isSynced: false,
      conflictState: null,
    });

    await db
      .update(schema.stories)
      .set({ lastOperationLog: nextOperationVersion })
      .where(eq(schema.stories.id, conflict.storyId));
  };

  /** A generic read of the local entity, used when recreating something removed on the server. */
  const readLocalEntity = async (
    entityType: string,
    entityId: string,
  ): Promise<Record<string, any> | undefined> => {
    const table = getEntityTable(entityType);
    if (!table) return undefined;
    const rows = await db
      .select()
      .from(table)
      .where(eq((table as any).id, entityId))
      .limit(1);
    return rows.at(0) as Record<string, any> | undefined;
  };

  /** Writes values into the local entity and aligns the version with the server's. */
  const writeEntity = async (
    entityType: string,
    entityId: string,
    values: Record<string, any>,
    version: number,
  ) => {
    const table = getEntityTable(entityType);
    if (!table) {
      console.log(`SyncConflictService: no local table registered for entity type ${entityType}.`);
      return;
    }

    const columns = toEntityColumns(entityType, values);
    await db
      .update(table)
      .set({ ...columns, version, updatedAt: new Date() })
      .where(eq((table as any).id, entityId));
  };

  /**
   * Applies the order the server holds, with the same logic used when applying an ordinary
   * remote reorder (see `SyncEngineService`), except versions: the abandoned local op already
   * bumped these rows speculatively, so the apply only moves indices and the container is
   * aligned exactly instead. Shared by keep-server and dismiss - both abandon the local order.
   */
  const applyServerOrder = async (conflict: PendingConflict) => {
    const reorderItems = conflict.serverValues?.reorderItems as
      | { id: string; newIndex: number }[]
      | undefined;
    if (reorderItems && reorderItems.length > 0) {
      await applyReorderToLocalDb(
        db,
        {
          entity: conflict.entityType,
          reorderItems,
          reorderTarget: conflict.serverValues?.reorderTarget,
        } as ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate,
        new Date(),
        { bumpVersions: false },
      );
    }
    const serverVersion =
      conflict.serverVersion ?? (conflict.serverValues?.version as number | undefined);
    if (typeof serverVersion === 'number') {
      await writeEntity(conflict.entityType, conflict.entityId, {}, serverVersion);
    }
  };

  const api: SyncConflictService = {
    async recordConflict(input: RecordConflictInput): Promise<void> {
      await blockOperations(input.localOperationIds);

      // One conflict per entity: if there is already one pending for it, the new push only brings fresher
      // information from the server, not a second decision to take.
      const existing = await db.query.syncConflicts.findFirst({
        where: and(
          eq(schema.syncConflicts.storyId, input.storyId),
          eq(schema.syncConflicts.entityType, input.entityType),
          eq(schema.syncConflicts.entityId, input.entityId),
          eq(schema.syncConflicts.status, 'pending'),
        ),
      });

      if (existing) {
        const mergedOperationIds = Array.from(
          new Set([
            ...parseJson<string[]>(existing.localOperationIds, []),
            ...input.localOperationIds,
          ]),
        );
        await db
          .update(schema.syncConflicts)
          .set({
            reason: input.reason,
            localOperationType: input.localOperationType,
            localOperationIds: JSON.stringify(mergedOperationIds),
            localValues: JSON.stringify({
              ...parseJson<Record<string, any>>(existing.localValues, {}),
              ...input.localValues,
            }),
            serverValues:
              input.serverValues === undefined
                ? existing.serverValues
                : JSON.stringify(input.serverValues),
            clientVersion: input.clientVersion ?? existing.clientVersion,
            serverVersion: input.serverVersion ?? existing.serverVersion,
            message: input.message ?? existing.message,
          })
          .where(eq(schema.syncConflicts.id, existing.id));
        entityEventEmitter.emit('sync_conflicts_changed', input.storyId);
        return;
      }

      await db.insert(schema.syncConflicts).values({
        id: createULID(),
        storyId: input.storyId,
        entityType: input.entityType,
        entityId: input.entityId,
        reason: input.reason,
        localOperationType: input.localOperationType,
        localOperationIds: JSON.stringify(input.localOperationIds),
        localValues: JSON.stringify(input.localValues),
        serverValues:
          input.serverValues === undefined || input.serverValues === null
            ? null
            : JSON.stringify(input.serverValues),
        clientVersion: input.clientVersion ?? null,
        serverVersion: input.serverVersion ?? null,
        message: input.message ?? null,
        status: 'pending',
        detectedAt: new Date(),
      });

      entityEventEmitter.emit('sync_conflicts_changed', input.storyId);
    },

    async getPendingConflicts(storyId?: string): Promise<PendingConflict[]> {
      const rows = await db.query.syncConflicts.findMany({
        where: storyId
          ? and(
              eq(schema.syncConflicts.status, 'pending'),
              eq(schema.syncConflicts.storyId, storyId),
            )
          : eq(schema.syncConflicts.status, 'pending'),
        orderBy: asc(schema.syncConflicts.detectedAt),
      });
      return rows.map(toPendingConflict);
    },

    async countPendingConflicts(storyId?: string): Promise<number> {
      const rows = await db.query.syncConflicts.findMany({
        where: storyId
          ? and(
              eq(schema.syncConflicts.status, 'pending'),
              eq(schema.syncConflicts.storyId, storyId),
            )
          : eq(schema.syncConflicts.status, 'pending'),
        columns: { id: true },
      });
      return rows.length;
    },

    async resolveKeepLocal(conflictId: string, chosenValues?: Record<string, any>): Promise<void> {
      const conflict = await getConflict(conflictId);
      if (!conflict) {
        console.log(`SyncConflictService: conflict ${conflictId} not found.`);
        return;
      }

      if (conflict.localOperationType === 'reorder') {
        // Unlike the other types, there is no entity row for "the order" - the pending reorder operation
        // already holds the right indices, it only has to be rebased onto the server's current version and
        // released to go in the next push. It does not go through
        // `abandonOperations`/`recordRebasedOperation` (which discard and recreate the operation): here the
        // same operation carries on, only with an updated base.
        const baseVersion = conflict.serverVersion ?? 0;
        // Chain the released operations onto the server's version (the first rests on it, each
        // next one on the following version), like the scalar rebase: giving every op the same
        // base would make all but the first conflict again on push.
        const ops = [];
        for (const opId of conflict.localOperationIds) {
          const op = await db.query.operationLogs.findFirst({
            where: eq(schema.operationLogs.id, opId),
          });
          if (op) ops.push(op);
        }
        ops.sort((left, right) => left.operationVersion - right.operationVersion);
        let base = baseVersion;
        let rebased = 0;
        const itemIds = new Set<string>();
        let reorderTarget: unknown;
        for (const op of ops) {
          const payload = parseJson<Record<string, any>>(op.payload, {});
          payload.version = base + 1;
          await db
            .update(schema.operationLogs)
            .set({ payload: JSON.stringify(payload), conflictState: null })
            .where(eq(schema.operationLogs.id, op.id));
          base += 1;
          rebased += 1;
          if (reorderTarget === undefined) reorderTarget = payload.reorderTarget;
          const items = payload.reorderItems;
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item && typeof item.id === 'string') itemIds.add(item.id);
            }
          }
        }
        // Anticipate the push: the server bumps every touched row once per released op, so the
        // rows rest at serverVersion + chain - the versions the server will hold once these land.
        // Without this the next edit bases itself on a stale version and conflicts spuriously.
        // Bump-up only: a row already past the target stays where it is rather than regressing.
        if (rebased > 0) {
          const target = baseVersion + rebased;
          const bumpRowTo = async (table: SyncTable, id: string) => {
            const rows = await db
              .select()
              .from(table)
              .where(eq((table as any).id, id))
              .limit(1);
            const current = (rows.at(0) as Record<string, unknown> | undefined)?.version;
            if (typeof current === 'number' && current < target) {
              await db
                .update(table)
                .set({ version: target, updatedAt: new Date() })
                .where(eq((table as any).id, id));
            }
          };
          const itemTable = reorderItemTable(conflict.entityType, reorderTarget);
          if (itemTable) {
            for (const id of itemIds) {
              await bumpRowTo(itemTable, id);
            }
          }
          const containerTable = getEntityTable(conflict.entityType);
          if (containerTable) {
            await bumpRowTo(containerTable, conflict.entityId);
          }
        }
        await closeConflict(conflictId, 'keep_local');
        entityEventEmitter.emit('sync_conflicts_changed', conflict.storyId);
        entityEventEmitter.emit('operation_log_updated', conflict.storyId);
        return;
      }

      // With no server version there is nothing to rebase onto. 0 only works when the entity does not exist
      // there yet (a create); on an update/delete against a live row that comes back as `version_conflict`
      // rather than last-write-wins.
      const baseVersion = conflict.serverVersion ?? 0;
      const values = chosenValues ?? conflict.localValues;

      await abandonOperations(conflict.localOperationIds);

      if (conflict.isLocalDelete) {
        // The user deleted; keeping their decision means resending the deletion on top of the server's current
        // version.
        await writeEntity(
          conflict.entityType,
          conflict.entityId,
          { isDeleted: true, deletedAt: new Date() },
          baseVersion + 1,
        );
        await recordRebasedOperation(
          conflict,
          'delete',
          { id: conflict.entityId, isDeleted: true },
          baseVersion,
        );
      } else if (
        conflict.localOperationType === 'create' ||
        conflict.reason === 'not_found' ||
        conflict.reason === 'limit_exceeded'
      ) {
        // The entity does not exist on the server - either because the original local operation was already a
        // `create` (whatever the refusal reason - `not_found` from a missing dependency, `limit_exceeded` from
        // the plan's ceiling, or even `unknown` from a validation failure on the server), or because it was
        // removed there afterwards (`not_found` on an operation that was an `update`/`reorder`). In all those
        // cases "keep my version" has to resend as a `create`, not an `update`: an `update` against an entity
        // the server never had would come back as a new `not_found` conflict rather than giving the attempt a
        // real chance to go through - exactly the loop that kept a GalleryRelation stuck forever when its owner
        // did not exist on the server yet.
        const local = await readLocalEntity(conflict.entityType, conflict.entityId);
        await recordRebasedOperation(
          conflict,
          'create',
          { ...(local ?? {}), ...values, isDeleted: false },
          0,
        );
        await writeEntity(
          conflict.entityType,
          conflict.entityId,
          { ...values, isDeleted: false, deletedAt: null },
          1,
        );
      } else {
        // It includes the `deleted_on_server` case: sending `isDeleted: false` restores the entity on the
        // server along with the values the user wrote.
        const restoreFields = conflict.isDeletedOnServer ? { isDeleted: false } : {};
        const nextValues = { ...values, ...restoreFields };
        // It only resends the fields that genuinely differ from what the server holds now. Without this, "keep
        // mine" resent the whole value even when it already matched what is there (both sides renaming to the
        // same text, say) - a new operation in the log with no actually new information, just noise.
        const changedValues = Object.fromEntries(
          Object.entries(nextValues).filter(([field, value]) =>
            syncConflictValuesDiffer(value, conflict.serverValues?.[field]),
          ),
        );
        // With nothing to resend there is no optimistic version to anticipate: the row aligns to
        // the server's version instead of base + 1, or the next edit would base itself one ahead
        // of the server and conflict spuriously.
        const hasChanges = Object.keys(changedValues).length > 0;
        await writeEntity(
          conflict.entityType,
          conflict.entityId,
          { ...nextValues, deletedAt: null },
          hasChanges ? baseVersion + 1 : baseVersion,
        );
        if (hasChanges) {
          await recordRebasedOperation(conflict, 'update', changedValues, baseVersion);
        }
      }

      await closeConflict(
        conflictId,
        chosenValues ? 'merge' : conflict.isDeletedOnServer ? 'restore' : 'keep_local',
      );
      entityEventEmitter.emit('sync_conflicts_changed', conflict.storyId);
      entityEventEmitter.emit('operation_log_updated', conflict.storyId);
    },

    async resolveKeepServer(conflictId: string): Promise<void> {
      const conflict = await getConflict(conflictId);
      if (!conflict) {
        console.log(`SyncConflictService: conflict ${conflictId} not found.`);
        return;
      }

      await abandonOperations(conflict.localOperationIds);

      if (conflict.localOperationType === 'reorder') {
        // Likewise: there is no entity row to write, it is the order of N other rows.
        await applyServerOrder(conflict);
      } else if (!conflict.serverValues) {
        // The server does not have the entity. Accepting that means removing it here - and without recording an
        // operation, because there is nothing to tell whoever no longer has it.
        await writeEntity(
          conflict.entityType,
          conflict.entityId,
          { isDeleted: true, deletedAt: new Date() },
          (conflict.serverVersion ?? 0) + 1,
        );
      } else {
        await writeEntity(
          conflict.entityType,
          conflict.entityId,
          conflict.serverValues,
          conflict.serverVersion ?? conflict.serverValues.version ?? 1,
        );
      }

      await closeConflict(conflictId, conflict.isDeletedOnServer ? 'discard' : 'keep_server');
      entityEventEmitter.emit('sync_conflicts_changed', conflict.storyId);
      entityEventEmitter.emit('operation_log_updated', conflict.storyId);
    },

    async resolveKeepServerAndCloneBoard(
      conflictId: string,
      currentUserId: string,
      cloneName: string,
    ): Promise<void> {
      const conflict = await getConflict(conflictId);
      if (!conflict || conflict.entityType !== 'Board') {
        throw new Error('Board clone is only available for a Board content conflict.');
      }
      const original = await db.query.boards.findFirst({
        where: eq(schema.boards.id, conflict.entityId),
      });
      const rawContent = conflict.localValues.content ?? original?.content;
      const content = validateBoardContent(rawContent ?? { nodes: [], edges: [] });
      await createBoardService(db).createBoard(currentUserId, {
        storyId: conflict.storyId,
        name: cloneName.slice(0, 120),
        description: original?.description ?? null,
        content,
      });
      await api.resolveKeepServer(conflictId);
    },

    async dismissConflict(conflictId: string): Promise<void> {
      const conflict = await getConflict(conflictId);
      // Without this, dismissing just hides the conflict from the pending list while its
      // operations stay `conflictState: 'conflicted'` forever - excluded from every future
      // push batch (see `getPushableOperations`'s `isNull(conflictState)` filter) with no way
      // left to resolve or retry them.
      if (conflict) {
        await abandonOperations(conflict.localOperationIds);
        // Dismissing drops the local operations for good, so the row must stop showing their
        // values: leaving them in place displays edits that will never sync (and quietly
        // vanish on reinstall) as if they were saved. Reverting to the server's copy keeps the
        // screen honest; without a server copy (a create that never landed) there is nothing
        // to revert to, so the row stays as the only copy of the user's work.
        if (conflict.serverValues) {
          if (conflict.localOperationType === 'reorder') {
            await applyServerOrder(conflict);
          } else {
            const serverVersion =
              conflict.serverVersion ?? (conflict.serverValues?.version as number | undefined);
            await writeEntity(
              conflict.entityType,
              conflict.entityId,
              conflict.serverValues,
              serverVersion ?? 1,
            );
          }
        }
      }
      await db
        .update(schema.syncConflicts)
        .set({ status: 'dismissed', resolvedAt: new Date() })
        .where(eq(schema.syncConflicts.id, conflictId));
      if (conflict) {
        entityEventEmitter.emit('sync_conflicts_changed', conflict.storyId);
      }
    },
  };
  return api;
};
