import type {
  ChapterReorderingStoryUpdate,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  EffectiveStoryRole,
  StoryReorderingStoryUpdate,
  StoryUpdate,
  SyncAppliedOperation,
  SyncConflict,
  UpdateStoryUpdate,
} from '@keres/shared';
import { sameReorderArrangement } from '@keres/shared';
import { and, desc, eq, gt, max } from 'drizzle-orm';
import { z } from 'zod';
import { db, withTransaction, type CompatibleDb } from '../../db';
import { operationLog, stories } from '../../db/schema';
import { AppError } from '../../utils/errors';
import { eventManager } from '../../utils/EventManager';
import { logger } from '../../utils/logger';
import type {
  SyncEntityRow,
  SyncEntityHandler,
  SyncPayload,
} from '../entity-sync-handlers/BaseSyncEntityHandler';
import { SyncConflictError } from '../entity-sync-handlers/BaseSyncEntityHandler';
import { storyPermissionService } from '../StoryPermissionService';
import { TierLimitExceededError, tierEnforcementService } from '../TierEnforcementService';
import { getChangedFieldsSinceVersion, serializeSyncEntity } from './SyncConflictDetails';
import { compactStoryUpdateHistory } from './SyncHistoryCompaction';
import type { SyncOperationLogService } from './SyncOperationLogService';
import { ensurePublicFavoriteOperationLogs } from './publicFavoriteRepair';

/**
 * Whether a logged reorder row disputes the same row set as the incoming op. Chapters reorder
 * scenes only; a Story reorder is scoped by its target (absent means chapters), and a
 * schema-field order additionally by its entity type. Anything unrecognised fails closed.
 */
function reorderTwinTargetMatches(
  entity: string,
  logged: { reorderTarget?: unknown; schemaEntityType?: unknown },
  incoming: { reorderTarget?: unknown; schemaEntityType?: unknown },
): boolean {
  if (entity !== 'Story') return true;
  const loggedTarget = logged.reorderTarget ?? undefined;
  const incomingTarget = incoming.reorderTarget ?? undefined;
  if (loggedTarget !== incomingTarget) return false;
  if (incomingTarget === 'StorySchemaField') {
    return (
      typeof logged.schemaEntityType === 'string' &&
      logged.schemaEntityType === incoming.schemaEntityType
    );
  }
  return true;
}

/**
 * Transactional write side of the API sync protocol. It authorizes a story-level batch, delegates
 * each entity mutation and policy decision to its handler, records accepted mutations atomically,
 * and turns expected refusals into per-operation conflicts without aborting unrelated operations.
 */
export class SyncPushService {
  constructor(
    private readonly entityHandlers: ReadonlyMap<string, SyncEntityHandler>,
    private readonly appendOperationLog: SyncOperationLogService['append'],
  ) {}

  /**
   * Applies a batch of operations coming from a client, one at a time.
   *
   * The batch is deliberately *not* all-or-nothing. Before, the first refused operation threw and
   * aborted the rest - but the earlier operations had already been written to the entity tables and
   * the operation log was only recorded at the end, so a broken batch left the server with data no
   * other client would ever see. Now each operation is applied and recorded individually, and the
   * refused ones come back described in `conflicts` for the client to resolve with the user.
   */
  async processAndRecordUpdates(
    userId: string,
    storyId: string,
    updates: StoryUpdate[],
  ): Promise<{
    lastOperationVersion: number;
    applied: SyncAppliedOperation[];
    conflicts: SyncConflict[];
  }> {
    // Authorization check
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      throw new Error('Story not found.');
    }

    let role: EffectiveStoryRole | undefined;
    if (story.userId === userId) {
      role = 'owner';
    } else {
      const permission = await storyPermissionService.getUserPermissionForStory(userId, storyId);
      if (
        permission &&
        (permission.permissionType === 'writer' || permission.permissionType === 'reader')
      ) {
        role = permission.permissionType;
      }
    }

    if (!role) {
      throw new AppError(403, 'Unauthorized: User does not have access to this story.');
    }

    const applied: SyncAppliedOperation[] = [];
    const conflicts: SyncConflict[] = [];
    /**
     * Entities that already conflicted in this batch. The following operations on them were built on
     * top of a base we have just refused, so applying them would corrupt the state - they are refused
     * along with it, and the conflict screen treats the entity as a single case. Reorders are exempt:
     * an absolute arrangement judged against the live rows cannot merge onto refused content.
     */
    const blockedEntities = new Set<string>();

    let lastOperationVersion = await this.getMaxOperationVersion(storyId);

    for (const update of updates) {
      const entityId = update.id || '';
      const entityKey = `${update.entity}:${entityId}`;

      const recordConflict = (
        reason: SyncConflict['reason'],
        message: string,
        extra?: Partial<SyncConflict>,
      ) => {
        blockedEntities.add(entityKey);
        conflicts.push({
          clientOperationId: update.clientOperationId,
          entity: update.entity,
          entityId,
          type: update.type,
          reason,
          message,
          ...extra,
        });
      };

      const handler = this.entityHandlers.get(update.entity);
      if (!handler) {
        recordConflict('unknown', `No sync handler registered for entity type: ${update.entity}`);
        continue;
      }

      const policyContext = {
        userId,
        storyId,
        role,
        allowReaderComments: story.allowReaderComments,
        update,
      };

      if (role === 'reader' && !handler.allowsReaderWrite(policyContext)) {
        recordConflict(
          'unauthorized',
          `Reader access does not permit changes to ${update.entity}.`,
        );
        continue;
      }

      try {
        handler.assertOperationAllowed(policyContext);
      } catch (error) {
        if (error instanceof SyncConflictError) {
          recordConflict(error.reason, error.message);
          continue;
        }
        throw error;
      }

      // A refused operation blocks what follows on its entity - except reorders. A reorder carries
      // an absolute arrangement validated against the live rows at apply time, so judging it on
      // its own merits can never merge onto refused content the way a chained field edit would;
      // skipping it would only manufacture a conflict for an op that could have been decided.
      if (blockedEntities.has(entityKey) && update.type !== 'reorder') {
        recordConflict(
          'version_conflict',
          `Skipped: an earlier operation on ${entityKey} in this batch conflicted.`,
        );
        continue;
      }

      let currentEntity: SyncEntityRow | undefined;

      /** Context the conflict screen uses to build the side-by-side comparison. */
      const conflictContext = (): Partial<SyncConflict> => ({
        serverEntity: currentEntity ? serializeSyncEntity(currentEntity) : null,
        attemptedChanges:
          update.type === 'create'
            ? (update as CreateStoryUpdate).data
            : update.type === 'update'
              ? (update as UpdateStoryUpdate).changes
              : undefined,
        serverVersion: currentEntity?.version,
        clientVersion:
          update.type === 'update'
            ? (update as UpdateStoryUpdate).changes?.version
            : update.version,
      });

      /**
       * Already applied: nothing to write, but the client needs to know it went through - and
       * at WHICH server version. Reporting the batch's current max here (rather than the
       * version that actually holds the effect, or 0 when no row holds it) makes the client
       * mark its op with a version that belongs to somebody else's operation, and its echo
       * check then skips that operation on the next pull: a silent, permanent data loss.
       */
      let alreadyAppliedVersion: number | null = null;
      /** Filled in inside the transaction when the operation writes something new. */
      let writeResult: {
        logged: { id: string; operationVersion: number };
        entityAfter: SyncEntityRow | undefined;
      } | null = null;

      try {
        // Writing the entity and recording it in the operation log run in the same transaction: without
        // that, a failure between the two steps (say, the process dying) left the entity changed but
        // invisible to other clients, and a resend of the same operation by the very client that originated
        // it hit a false `version_conflict` against its own work. Handlers receive this `tx` explicitly.
        await withTransaction(async (tx) => {
          // Creation handlers historically own their insert timestamps, and several of them do not
          // call BaseSyncEntityHandler.parseOperationTime(). Validate at the protocol boundary as
          // well, so a client clock cannot place *any* operation ahead of the server's history.
          this.assertOperationTimeIsValid(update.operationTime);

          // A read inside the transaction: the create-vs-alreadyApplied / not_found decision has to see the
          // same row the write is going to touch.
          currentEntity = await handler.findById(entityId, tx);

          if (currentEntity && !handler.checkBelongsToStory(currentEntity, storyId)) {
            throw new SyncConflictError(
              'unauthorized',
              `Entity ${entityId} does not belong to story ${storyId}.`,
            );
          }

          if (currentEntity) {
            handler.assertEntityMutationAllowed({ ...policyContext, currentEntity });
          }

          if (update.type === 'create') {
            if (currentEntity) {
              const createData = (update as CreateStoryUpdate).data;
              // The entity may have changed since its creation, so its current row is not always
              // the correct reference for a retried create. The server's operation log preserves
              // the original accepted create payload and is the authoritative idempotency record.
              const [recordedCreate] = await tx
                .select({
                  payload: operationLog.payload,
                  operationVersion: operationLog.operationVersion,
                })
                .from(operationLog)
                .where(
                  and(
                    eq(operationLog.storyId, storyId),
                    eq(operationLog.entityType, update.entity),
                    eq(operationLog.entityId, entityId),
                    eq(operationLog.operationType, 'create'),
                  ),
                )
                .limit(1);
              const matchesCurrent = handler.createPayloadMatches(currentEntity, createData);
              const matchesRecordedCreate =
                !!recordedCreate &&
                handler.createPayloadMatches(
                  (recordedCreate.payload ?? {}) as SyncPayload,
                  createData,
                );
              if (!matchesCurrent && !matchesRecordedCreate) {
                throw new SyncConflictError(
                  'validation',
                  `An entity with ID ${entityId} already exists with different data.`,
                );
              }
              // The recorded row's own version: the echo check on the client keys on it, and a
              // fresher number would mask whatever operation actually sits there. Zero when no
              // recorded row exists (the row came from outside sync): no pull ever carries 0.
              alreadyAppliedVersion = recordedCreate?.operationVersion ?? 0;
            } else {
              if (handler.tierLimitScope === 'story') {
                await tierEnforcementService.assertCanCreateStory(userId);
              } else if (handler.tierLimitScope === 'entity') {
                await tierEnforcementService.assertCanCreateEntity(userId, storyId);
              }
              await handler.create(userId, storyId, update as CreateStoryUpdate, tx);
            }
          } else if (update.type === 'update' || update.type === 'reorder') {
            if (!currentEntity) {
              throw new SyncConflictError(
                'not_found',
                `${update.entity} with ID ${entityId} does not exist on the server.`,
              );
            }
            if (
              update.type === 'reorder' &&
              typeof update.version === 'number' &&
              update.version !== currentEntity.version
            ) {
              // Stale base: the arrangement may still have landed - under a LATER version than
              // this op can see, when a chained reorder was applied after it. The live-row
              // comparison in the handler cannot recognise that (the rows moved on), but history
              // can: a twin applied past this base proves the intent already took effect, and its
              // own version is what the client's echo check must key on.
              const twin = await this.findAppliedReorderTwin(
                tx,
                storyId,
                update,
                entityId,
                update.version,
              );
              if (twin) {
                alreadyAppliedVersion = twin.operationVersion;
              }
            }
            if (alreadyAppliedVersion === null) {
              await handler.update(userId, storyId, update as UpdateStoryUpdate, currentEntity, tx);
            }
            if (update.type === 'reorder' && alreadyAppliedVersion === null) {
              // A reorder whose arrangement already holds is a no-op resend: the handler applied
              // nothing (reorder branches always bump the container version when they write), so
              // logging it again would only churn versions and the pull stream. Report it as the
              // idempotent success it is, with no version of its own.
              const afterReorder = await handler.findById(entityId, tx).catch(() => undefined);
              if (afterReorder && afterReorder.version === currentEntity.version) {
                alreadyAppliedVersion = 0;
              }
            }
          } else if (update.type === 'delete') {
            if (!currentEntity || handler.isDeletedRow(currentEntity)) {
              // Deleting something the server does not have - or already tombstoned - is the
              // desired outcome, not an error, and logging it again would only churn versions.
              alreadyAppliedVersion = 0;
            } else {
              const deleteUpdate = handler.prepareDelete(
                { ...policyContext, currentEntity },
                update as DeleteStoryUpdate,
              );
              await handler.delete(userId, storyId, deleteUpdate, currentEntity, tx);
            }
          }

          if (alreadyAppliedVersion !== null) return;

          // The entity's version *after* the operation, read back so the client knows which base its next
          // edits rest on.
          const entityAfter = await handler.findById(entityId, tx).catch(() => undefined);
          const logged = await this.appendOperationLog(
            {
              storyId,
              userId,
              update,
              entityId,
              entityVersion: entityAfter?.version,
            },
            tx,
          );
          writeResult = { logged, entityAfter };
        });
      } catch (error) {
        if (error instanceof TierLimitExceededError) {
          recordConflict('limit_exceeded', error.message, conflictContext());
          continue;
        }
        if (error instanceof SyncConflictError) {
          const context = conflictContext();
          const clientVersion = error.clientVersion ?? context.clientVersion;
          // It only makes sense for a `version_conflict` on an `update` of an entity that still exists - the
          // other reasons (deletion, broken reference, validation...) are not "the base went stale", they have
          // no field delta to compute.
          const changedFields =
            error.reason === 'version_conflict' &&
            update.type === 'update' &&
            currentEntity &&
            typeof clientVersion === 'number'
              ? await getChangedFieldsSinceVersion(storyId, update.entity, entityId, clientVersion)
              : undefined;
          recordConflict(error.reason, error.message, {
            ...context,
            clientVersion,
            serverVersion: error.serverVersion ?? context.serverVersion,
            changedFields,
          });
          continue;
        }
        if (error instanceof z.ZodError) {
          recordConflict(
            'validation',
            `Invalid payload for ${entityKey}: ${error.message}`,
            conflictContext(),
          );
          continue;
        }
        // An unexpected failure while applying this operation. Recorded as a conflict rather than taking the
        // batch down: the user's other operations can still be saved, and the client stops resending in a
        // loop an operation that will never go through.
        logger.error(`SyncService: failed to apply ${update.type} on ${entityKey}`, error);
        recordConflict(
          'unknown',
          `Failed to apply ${update.type} on ${entityKey}: ${(error as Error)?.message}`,
          conflictContext(),
        );
        continue;
      }

      if (alreadyAppliedVersion !== null) {
        applied.push({
          clientOperationId: update.clientOperationId,
          operationVersion: alreadyAppliedVersion,
          entityVersion: currentEntity?.version,
          entity: update.entity,
          entityId,
        });
        continue;
      }

      const { logged, entityAfter } = writeResult!;
      lastOperationVersion = logged.operationVersion;
      applied.push({
        clientOperationId: update.clientOperationId,
        operationId: logged.id,
        operationVersion: logged.operationVersion,
        entityVersion: entityAfter?.version,
        entity: update.entity,
        entityId,
      });
    }

    if (applied.length > 0) {
      // Broadcast the updates to WebSocket clients subscribed to this storyId
      eventManager.emit(`storyUpdate:${storyId}`, {
        type: 'story_update',
        storyId: storyId,
        updates: applied.length,
        maxOperationVersion: lastOperationVersion,
        originatingUser: userId,
      });

      // Best-effort history compaction: old update runs collapse into their final state. A
      // compaction failure must never fail the push that just succeeded.
      try {
        await compactStoryUpdateHistory(storyId);
      } catch (error) {
        logger.error('SyncService: history compaction failed', error);
      }
    }

    if (applied.some((operation) => operation.entity === 'Story')) {
      await this.repairPublicFavoritesAfterStoryChange(storyId);
    }

    return { lastOperationVersion, applied, conflicts };
  }

  /**
   * A Story op may have flipped `favoriteBehavior` to `individual_public`, exposing imported
   * favorites that have no operation logs. Repairing here - once per story edit, not once per
   * pull per client - covers the switch at its source. Best-effort like compaction: the
   * pull-time fingerprint mismatch re-runs the same repair, so a failure here self-heals.
   */
  private async repairPublicFavoritesAfterStoryChange(storyId: string): Promise<void> {
    try {
      const current = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
        columns: { favoriteBehavior: true },
      });
      if (current?.favoriteBehavior === 'individual_public') {
        await ensurePublicFavoriteOperationLogs(storyId);
      }
    } catch (error) {
      logger.error('SyncService: public favorite repair after story change failed', error);
    }
  }

  private async getMaxOperationVersion(storyId: string): Promise<number> {
    const result = await db
      .select({ maxVersion: max(operationLog.operationVersion) })
      .from(operationLog)
      .where(eq(operationLog.storyId, storyId));
    return result.at(0)?.maxVersion || 0;
  }

  /**
   * A logged reorder already carrying this op's exact arrangement, newest first. Only rows
   * applied *past* the op's base qualify: an older twin means the world moved on since, and
   * the op is genuinely divergent. Rows without an entity version predate that column and
   * cannot prove anything, so the comparison excludes them.
   */
  private async findAppliedReorderTwin(
    tx: CompatibleDb,
    storyId: string,
    update: StoryUpdate,
    entityId: string,
    baseVersion: number,
  ): Promise<{ operationVersion: number } | undefined> {
    const reorder = update as ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate;
    if (!Array.isArray(reorder.reorderItems) || reorder.reorderItems.length === 0) {
      return undefined;
    }
    const rows = await tx
      .select({
        operationVersion: operationLog.operationVersion,
        entityVersion: operationLog.entityVersion,
        payload: operationLog.payload,
      })
      .from(operationLog)
      .where(
        and(
          eq(operationLog.storyId, storyId),
          eq(operationLog.entityType, update.entity),
          eq(operationLog.entityId, entityId),
          eq(operationLog.operationType, 'reorder'),
          gt(operationLog.entityVersion, baseVersion),
        ),
      )
      .orderBy(desc(operationLog.operationVersion));
    for (const row of rows) {
      const payload = (row.payload ?? {}) as {
        reorderItems?: unknown;
        reorderTarget?: unknown;
        schemaEntityType?: unknown;
      };
      const incomingTarget = reorder as {
        reorderTarget?: unknown;
        schemaEntityType?: unknown;
      };
      if (!reorderTwinTargetMatches(update.entity, payload, incomingTarget)) continue;
      if (
        Array.isArray(payload.reorderItems) &&
        sameReorderArrangement(payload.reorderItems, reorder.reorderItems)
      ) {
        return { operationVersion: row.operationVersion };
      }
    }
    return undefined;
  }

  /** Reject malformed or materially future client clocks for every operation kind, including creates. */
  private assertOperationTimeIsValid(operationTime: string | undefined): void {
    if (!operationTime) return;
    const timestamp = new Date(operationTime);
    if (Number.isNaN(timestamp.getTime())) {
      throw new SyncConflictError('validation', `Operation time ${operationTime} is invalid.`);
    }
    if (timestamp.getTime() > Date.now() + 1000) {
      throw new SyncConflictError(
        'validation',
        `Operation time ${operationTime} cannot be in the future.`,
      );
    }
  }

  /**
   * Which fields actually changed on this entity since the version the client read as its base - the
   * difference between "the client's base went stale" (`version_conflict`, which only compares the
   * version number) and "something the client also edited genuinely changed". Without it, the client
   * has no way to know whether a `version_conflict` was caused by an edit to a field other than its
   * own (perfectly mergeable) or to the same field (a real decision) - `serverEntity` alone does not
   * get to that answer, because the current value of a field the client is editing always "looks"
   * different from the value the client wants to write, whether the server touched it or not.
   * `entityVersion` (the entity's version *after* each operation, see
   * `db/schema/tables/operationLog.ts`) is what makes it possible to reconstruct exactly the
   * operations that happened between the client's base and now.
   */
}
