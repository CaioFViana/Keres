import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  EffectiveStoryRole,
  StoryUpdate,
  SyncAppliedOperation,
  SyncConflict,
  UpdateStoryUpdate,
} from '@keres/shared';
import { and, eq, max } from 'drizzle-orm';
import { z } from 'zod';
import { db, withTransaction } from '../../db';
import { operationLog, stories } from '../../db/schema';
import { AppError } from '../../utils/errors';
import { eventManager } from '../../utils/EventManager';
import { logger } from '../../utils/logger';
import type { SyncEntityHandler } from '../entity-sync-handlers/BaseSyncEntityHandler';
import { SyncConflictError } from '../entity-sync-handlers/BaseSyncEntityHandler';
import { storyPermissionService } from '../StoryPermissionService';
import { TierLimitExceededError, tierEnforcementService } from '../TierEnforcementService';
import { getChangedFieldsSinceVersion, serializeSyncEntity } from './SyncConflictDetails';
import type { SyncOperationLogService } from './SyncOperationLogService';

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
     * along with it, and the conflict screen treats the entity as a single case.
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

      if (blockedEntities.has(entityKey)) {
        recordConflict(
          'version_conflict',
          `Skipped: an earlier operation on ${entityKey} in this batch conflicted.`,
        );
        continue;
      }

      let currentEntity: any;

      /** Contexto que a tela de conflito usa para montar o comparativo lado a lado. */
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

      /** Already applied: nothing to write, but the client needs to know it went through. */
      let alreadyApplied = false;
      /** Filled in inside the transaction when the operation writes something new. */
      let writeResult: {
        logged: { id: string; operationVersion: number };
        entityAfter: any;
      } | null = null;

      try {
        // Writing the entity and recording it in the operation log run in the same transaction: without
        // that, a failure between the two steps (say, the process dying) left the entity changed but
        // invisible to other clients, and a resend of the same operation by the very client that originated
        // it hit a false `version_conflict` against its own work. `db` resolves to this transaction in any
        // call made during `withTransaction`, including inside the entity handlers - they do not need to
        // know about it.
        await withTransaction(async () => {
          // Creation handlers historically own their insert timestamps, and several of them do not
          // call BaseSyncEntityHandler.parseOperationTime(). Validate at the protocol boundary as
          // well, so a client clock cannot place *any* operation ahead of the server's history.
          this.assertOperationTimeIsValid(update.operationTime);

          // A read inside the transaction: the create-vs-alreadyApplied / not_found decision has to see the
          // same row the write is going to touch.
          currentEntity = await handler.findById(entityId);

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
              const [recordedCreate] = await db
                .select({ payload: operationLog.payload })
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
                  recordedCreate.payload as Record<string, any>,
                  createData,
                );
              if (!matchesCurrent && !matchesRecordedCreate) {
                throw new SyncConflictError(
                  'validation',
                  `An entity with ID ${entityId} already exists with different data.`,
                );
              }
              alreadyApplied = true;
            } else {
              if (handler.tierLimitScope === 'story') {
                await tierEnforcementService.assertCanCreateStory(userId);
              } else if (handler.tierLimitScope === 'entity') {
                await tierEnforcementService.assertCanCreateEntity(userId, storyId);
              }
              await handler.create(userId, storyId, update as CreateStoryUpdate);
            }
          } else if (update.type === 'update' || update.type === 'reorder') {
            if (!currentEntity) {
              throw new SyncConflictError(
                'not_found',
                `${update.entity} with ID ${entityId} does not exist on the server.`,
              );
            }
            await handler.update(userId, storyId, update as UpdateStoryUpdate, currentEntity);
          } else if (update.type === 'delete') {
            if (!currentEntity) {
              // Deleting something the server does not have is the desired outcome, not an error.
              alreadyApplied = true;
            } else {
              const deleteUpdate = handler.prepareDelete(
                { ...policyContext, currentEntity },
                update as DeleteStoryUpdate,
              );
              await handler.delete(userId, storyId, deleteUpdate, currentEntity);
            }
          }

          if (alreadyApplied) return;

          // The entity's version *after* the operation, read back so the client knows which base its next
          // edits rest on.
          const entityAfter = await handler.findById(entityId).catch(() => undefined);
          const logged = await this.appendOperationLog({
            storyId,
            userId,
            update,
            entityId,
            entityVersion: entityAfter?.version,
          });
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

      if (alreadyApplied) {
        applied.push({
          clientOperationId: update.clientOperationId,
          operationVersion: lastOperationVersion,
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
    }

    return { lastOperationVersion, applied, conflicts };
  }

  private async getMaxOperationVersion(storyId: string): Promise<number> {
    const result = await db
      .select({ maxVersion: max(operationLog.operationVersion) })
      .from(operationLog)
      .where(eq(operationLog.storyId, storyId));
    return result.at(0)?.maxVersion || 0;
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
