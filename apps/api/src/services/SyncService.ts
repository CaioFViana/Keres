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
import { MAX_SYNC_PULL_BATCH, ownerOnlyFieldsIn } from '@keres/shared';
import { and, eq, gt, max, ne, or, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { z } from 'zod';
import { db, withTransaction } from '../db';
import { usingSqlite } from '../db/dialect';
import {
  favorites,
  operationLog,
  operationTypeEnum,
  stories,
  storyPermissions,
} from '../db/schema';
import { eventManager } from '../utils/EventManager'; // Import eventManager
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import type { SyncEntityHandler } from './entity-sync-handlers/BaseSyncEntityHandler';
import { SyncConflictError } from './entity-sync-handlers/BaseSyncEntityHandler';
import { TierLimitExceededError, tierEnforcementService } from './TierEnforcementService';
import { AttributeValueSyncHandler } from './entity-sync-handlers/AttributeValueSyncHandler';
import { ChapterSyncHandler } from './entity-sync-handlers/ChapterSyncHandler';
import { ChapterAnchorSyncHandler } from './entity-sync-handlers/ChapterAnchorSyncHandler';
import { BoardSyncHandler } from './entity-sync-handlers/BoardSyncHandler';
import { StoryCalendarSyncHandler } from './entity-sync-handlers/StoryCalendarSyncHandler';
import { CharacterRelationSyncHandler } from './entity-sync-handlers/CharacterRelationSyncHandler';
import { CharacterSceneSyncHandler } from './entity-sync-handlers/CharacterSceneSyncHandler';
import { CharacterSyncHandler } from './entity-sync-handlers/CharacterSyncHandler';
import { ChoiceCheckGroupSyncHandler } from './entity-sync-handlers/ChoiceCheckGroupSyncHandler';
import { ChoiceCheckSyncHandler } from './entity-sync-handlers/ChoiceCheckSyncHandler';
import { ChoiceSyncHandler } from './entity-sync-handlers/ChoiceSyncHandler';
import { EffectSyncHandler } from './entity-sync-handlers/EffectSyncHandler';
import { GalleryRelationSyncHandler } from './entity-sync-handlers/GalleryRelationSyncHandler';
import { GallerySyncHandler } from './entity-sync-handlers/GallerySyncHandler';
import { ItemJourneySyncHandler } from './entity-sync-handlers/ItemJourneySyncHandler';
import { PlotSyncHandler } from './entity-sync-handlers/PlotSyncHandler';
import { PlotSceneSyncHandler } from './entity-sync-handlers/PlotSceneSyncHandler';
import { RouteSyncHandler } from './entity-sync-handlers/RouteSyncHandler';
import { RouteStepSyncHandler } from './entity-sync-handlers/RouteStepSyncHandler';
import { ItemSyncHandler } from './entity-sync-handlers/ItemSyncHandler';
import { LocationRelationSyncHandler } from './entity-sync-handlers/LocationRelationSyncHandler';
import { LocationMapSyncHandler } from './entity-sync-handlers/LocationMapSyncHandler';
import { LocationSyncHandler } from './entity-sync-handlers/LocationSyncHandler';
import { NoteRelationSyncHandler } from './entity-sync-handlers/NoteRelationSyncHandler';
import { NoteSyncHandler } from './entity-sync-handlers/NoteSyncHandler';
import { SceneSyncHandler } from './entity-sync-handlers/SceneSyncHandler';
import { StorySchemaFieldSyncHandler } from './entity-sync-handlers/StorySchemaFieldSyncHandler';
import { StorySyncHandler } from './entity-sync-handlers/StorySyncHandler';
import { SuggestionSyncHandler } from './entity-sync-handlers/SuggestionSyncHandler';
import { TagRelationSyncHandler } from './entity-sync-handlers/TagRelationSyncHandler';
import { TagSyncHandler } from './entity-sync-handlers/TagSyncHandler';
import { WorldRuleSyncHandler } from './entity-sync-handlers/WorldRuleSyncHandler';
import { FavoriteSyncHandler } from './entity-sync-handlers/FavoriteSyncHandler';
import { SeeAlsoRelationSyncHandler } from './entity-sync-handlers/SeeAlsoRelationSyncHandler';
import { CommentSyncHandler } from './entity-sync-handlers/CommentSyncHandler';
import { ModeSyncHandler } from './entity-sync-handlers/ModeSyncHandler';
import { StatRelationSyncHandler } from './entity-sync-handlers/StatRelationSyncHandler';
import { StatStrengthSyncHandler } from './entity-sync-handlers/StatStrengthSyncHandler';
import { StatSyncHandler } from './entity-sync-handlers/StatSyncHandler';
import { storyPermissionService } from './StoryPermissionService';

/** Bookkeeping fields that never count as a "content change" in `getChangedFieldsSinceVersion`. */
const CHANGED_FIELDS_BOOKKEEPING = new Set([
  'id',
  'storyId',
  'version',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);

export class SyncService {
  private entityHandlers: Map<string, SyncEntityHandler>;

  constructor() {
    this.entityHandlers = new Map<string, SyncEntityHandler>();
    this.registerEntityHandler(new StorySyncHandler());
    this.registerEntityHandler(new CharacterSyncHandler());
    this.registerEntityHandler(new ChapterSyncHandler());
    this.registerEntityHandler(new LocationSyncHandler());
    this.registerEntityHandler(new SceneSyncHandler());
    this.registerEntityHandler(new GallerySyncHandler());
    this.registerEntityHandler(new GalleryRelationSyncHandler());
    this.registerEntityHandler(new NoteSyncHandler());
    this.registerEntityHandler(new WorldRuleSyncHandler());
    this.registerEntityHandler(new ChoiceSyncHandler());
    this.registerEntityHandler(new ChoiceCheckGroupSyncHandler());
    this.registerEntityHandler(new ChoiceCheckSyncHandler());
    this.registerEntityHandler(new EffectSyncHandler());
    this.registerEntityHandler(new CharacterSceneSyncHandler());
    this.registerEntityHandler(new ChapterAnchorSyncHandler());
    this.registerEntityHandler(new StoryCalendarSyncHandler());
    this.registerEntityHandler(new BoardSyncHandler());
    this.registerEntityHandler(new LocationMapSyncHandler());
    this.registerEntityHandler(new CharacterRelationSyncHandler());
    this.registerEntityHandler(new ItemSyncHandler());
    this.registerEntityHandler(new ItemJourneySyncHandler());
    this.registerEntityHandler(new PlotSyncHandler());
    this.registerEntityHandler(new PlotSceneSyncHandler());
    this.registerEntityHandler(new RouteSyncHandler());
    this.registerEntityHandler(new RouteStepSyncHandler());
    this.registerEntityHandler(new SuggestionSyncHandler());
    this.registerEntityHandler(new TagSyncHandler());
    this.registerEntityHandler(new TagRelationSyncHandler());
    this.registerEntityHandler(new NoteRelationSyncHandler());
    this.registerEntityHandler(new StorySchemaFieldSyncHandler());
    this.registerEntityHandler(new AttributeValueSyncHandler());
    this.registerEntityHandler(new LocationRelationSyncHandler());
    this.registerEntityHandler(new FavoriteSyncHandler());
    this.registerEntityHandler(new SeeAlsoRelationSyncHandler());
    this.registerEntityHandler(new CommentSyncHandler());
    this.registerEntityHandler(new ModeSyncHandler());
    this.registerEntityHandler(new StatSyncHandler());
    this.registerEntityHandler(new StatStrengthSyncHandler());
    this.registerEntityHandler(new StatRelationSyncHandler());
  }

  private registerEntityHandler(handler: SyncEntityHandler) {
    this.entityHandlers.set(handler.entityName, handler);
  }

  /** Exposto para AdminRecoveryService (restaurar entidades) e TierEnforcementService (contar uso). */
  getEntityHandlers(): ReadonlyMap<string, SyncEntityHandler> {
    return this.entityHandlers;
  }

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

      // Personal favorites are user-owned metadata, so readers may change their own rows
      // without gaining permission to edit the story itself. Comments are similar in spirit
      // but opt-in per story (`story.allowReaderComments`, only meaningful/shown for
      // server-linked stories) - when off, this check locks a reader out of create/update/
      // delete uniformly, including comments they already posted while it was on.
      const readerCanWriteEntity =
        update.entity === 'Favorite' || (update.entity === 'Comment' && story.allowReaderComments);
      if (role === 'reader' && !readerCanWriteEntity) {
        recordConflict(
          'unauthorized',
          'Reader access only permits personal favorite changes' +
            (story.allowReaderComments ? ' or comments.' : '.'),
        );
        continue;
      }

      if (update.entity === 'Story' && update.type === 'create' && update.id !== storyId) {
        recordConflict(
          'unauthorized',
          'Cannot create a different story through this sync endpoint.',
        );
        continue;
      }

      if (update.entity === 'Story' && update.type === 'delete' && role !== 'owner') {
        recordConflict('unauthorized', 'Only the story owner can delete the story.');
        continue;
      }

      if (update.entity === 'Story' && update.type === 'update' && role !== 'owner') {
        // The list comes from `@keres/shared`: it is the same one the client uses to refuse the edit before
        // writing to the operation log.
        const attempted = ownerOnlyFieldsIn(
          (update as UpdateStoryUpdate).changes as Record<string, unknown> | undefined,
        );
        if (attempted.length > 0 || (update as UpdateStoryUpdate).changes?.isDeleted === false) {
          recordConflict(
            'unauthorized',
            'Only the story owner can change story identity or policy.',
          );
          continue;
        }
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
        serverEntity: currentEntity ? this.serializeEntity(currentEntity) : null,
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
              if (update.entity === 'Story') {
                await tierEnforcementService.assertCanCreateStory(userId);
              } else if (update.entity !== 'Favorite' && update.entity !== 'Comment') {
                // Comments are annotations, not story content - they must neither consume nor be blocked by the
                // tier's entity limit, the same as Favorite.
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
              // Comment: a story's owner can delete any comment (moderation); a writer/reader only their own -
              // even with read access to comments turned off afterwards, the original author (if writer/reader)
              // only loses the ability to delete their own; the owner always can. Checked here rather than in
              // CommentSyncHandler, because `role` is only available in this function.
              if (
                update.entity === 'Comment' &&
                role !== 'owner' &&
                currentEntity.authorUserId !== userId
              ) {
                throw new SyncConflictError(
                  'unauthorized',
                  'Only the comment author or the story owner can delete this comment.',
                );
              }
              let deleteUpdate = update as DeleteStoryUpdate;
              if (
                update.entity === 'Story' &&
                role === 'owner' &&
                (update.version === undefined || update.version === null)
              ) {
                // deleteStory/unlinkFromServer omit the base on purpose (local Story.version
                // is not kept in lockstep). Fill in the live server version so OCC still
                // guards concurrent writers, without making the owner send a stale number.
                deleteUpdate = { ...deleteUpdate, version: currentEntity.version };
              }
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
              ? await this.getChangedFieldsSinceVersion(
                  storyId,
                  update.entity,
                  entityId,
                  clientVersion,
                )
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
      throw new SyncConflictError('validation', `Operation time ${operationTime} cannot be in the future.`);
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
  private async getChangedFieldsSinceVersion(
    storyId: string,
    entityType: string,
    entityId: string,
    sinceVersion: number,
  ): Promise<string[] | undefined> {
    // Deliberately no filter on `entityVersion` here: a row with a null `entity_version` (written before
    // that column existed, see its comment in `db/schema/tables/operationLog.ts`) cannot be compared
    // against `sinceVersion` - `gt(entityVersion, sinceVersion)` in Postgres is never true for NULL, so
    // that row would simply disappear from the union with no warning, and the set of changed fields
    // would come back incomplete (possibly hiding a real dispute, or, in the other direction, merging
    // silently over it). Fetching everything and deciding in code keeps that case detectable.
    const rows = await db.query.operationLog.findMany({
      where: and(
        eq(operationLog.storyId, storyId),
        eq(operationLog.entityType, entityType),
        eq(operationLog.entityId, entityId),
      ),
      columns: { payload: true, entityVersion: true },
    });

    if (rows.some((row) => row.entityVersion === null)) {
      return undefined;
    }

    const fields = new Set<string>();
    for (const row of rows) {
      if ((row.entityVersion as number) <= sinceVersion) continue;
      const payload = row.payload as Record<string, unknown> | null;
      for (const key of Object.keys(payload ?? {})) {
        // `version` is the base each operation declared, not a content field - it is present in every update
        // payload by construction, so including it here would make it look as if "the version" were always a
        // disputed field.
        if (CHANGED_FIELDS_BOOKKEEPING.has(key)) continue;
        fields.add(key);
      }
    }
    return Array.from(fields);
  }

  /**
   * Stories uploaded to the server as a snapshot may already contain favourites. Those rows never went
   * through SyncService and therefore have no operation the other collaborators could receive. When
   * favourites are made public, we materialise a create operation for each row that still has no
   * history.
   *
   * The lock on the Story serialises two pulls trying to run the repair at the same time. The log's id
   * is still an ordinary ULID; detection is by the entity's id.
   */
  private async ensurePublicFavoriteOperationLogs(
    storyId: string,
  ): Promise<{ count: number; maxOperationVersion: number }> {
    return await db.transaction(async (tx) => {
      // SQLite has no `FOR UPDATE` (and its transaction adapter does not expose `execute`). Its
      // single-writer transaction model already serializes this repair; Postgres still needs the
      // row lock to coordinate this pull-time repair with concurrent pushes.
      if (!usingSqlite) {
        await tx.execute(
          sql`select ${stories.id} from ${stories} where ${stories.id} = ${storyId} for update`,
        );
      }

      const [favoriteRows, loggedFavoriteRows, storyRow] = await Promise.all([
        tx
          .select()
          .from(favorites)
          .where(and(eq(favorites.storyId, storyId), eq(favorites.isDeleted, false))),
        tx
          .select({ entityId: operationLog.entityId })
          .from(operationLog)
          .where(
            and(
              eq(operationLog.storyId, storyId),
              eq(operationLog.entityType, 'Favorite'),
              eq(operationLog.operationType, 'create'),
            ),
          ),
        // The same counter `appendOperationLog` uses - the `for update` above guarantees the two do not step
        // on each other: any concurrent push trying to increment this story's `lastOperationVersion` waits
        // for this transaction to finish.
        tx
          .select({ lastOperationVersion: stories.lastOperationVersion })
          .from(stories)
          .where(eq(stories.id, storyId)),
      ]);

      const loggedIds = new Set(loggedFavoriteRows.map((row) => row.entityId));
      const missingFavorites = favoriteRows.filter((favorite) => !loggedIds.has(favorite.id));
      let nextOperationVersion = storyRow.at(0)?.lastOperationVersion || 0;

      for (const favorite of missingFavorites) {
        nextOperationVersion += 1;
        await tx.insert(operationLog).values({
          id: ulid(),
          storyId,
          userId: favorite.userId,
          operationVersion: nextOperationVersion,
          operationType: 'create',
          entityType: 'Favorite',
          entityId: favorite.id,
          payload: {
            entityId: favorite.entityId,
            entityType: favorite.entityType,
            userId: favorite.userId,
          },
          entityVersion: favorite.version,
          createdAt: favorite.createdAt,
        });
      }

      if (missingFavorites.length > 0) {
        await tx
          .update(stories)
          .set({ lastOperationVersion: nextOperationVersion })
          .where(eq(stories.id, storyId));
      }

      return { count: missingFavorites.length, maxOperationVersion: nextOperationVersion };
    });
  }

  /**
   * Records an operation in the log already carrying the story's next `operationVersion`.
   *
   * The numbering comes from a single-row `UPDATE` on `stories.lastOperationVersion` (see the comment
   * on the column itself), no longer from `max(operation_log.operation_version)`: two concurrent pushes
   * on the same story now never receive the same number, which used to make one of the two invisible
   * forever in other clients' incremental pulls.
   *
   * Public so AdminRecoveryService can record a restore made through the administration panel with the
   * same numbering logic, instead of duplicating it.
   */
  async appendOperationLog(args: {
    storyId: string;
    userId: string;
    update: StoryUpdate;
    entityId: string;
    entityVersion?: number;
  }): Promise<{ id: string; operationVersion: number }> {
    const { storyId, userId, update, entityId, entityVersion } = args;

    const handler = this.entityHandlers.get(update.entity);
    let payload: Record<string, any> = {};
    if (handler) {
      payload = handler.sanitizePayloadForLog(update, userId);
    } else if (update.type === 'delete') {
      payload = { id: entityId };
    } else if (update.type === 'reorder') {
      payload = {
        reorderItems: (update as ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate)
          .reorderItems,
        reorderTarget: (update as StoryReorderingStoryUpdate).reorderTarget,
        schemaEntityType: (update as StoryReorderingStoryUpdate).schemaEntityType,
      };
    }

    // An atomic counter instead of `coalesce(max(...), 0) + 1`: that subquery let two concurrent calls
    // for the same story compute the same next number before either committed (nothing serialised them).
    // A single-row `UPDATE` is itself serialised by Postgres's row lock - the second concurrent call
    // waits for the first to commit and sees the already-incremented value.
    const [{ nextOperationVersion } = { nextOperationVersion: undefined }] = await db
      .update(stories)
      .set({ lastOperationVersion: sql`${stories.lastOperationVersion} + 1` })
      .where(eq(stories.id, storyId))
      .returning({ nextOperationVersion: stories.lastOperationVersion });

    if (nextOperationVersion === undefined) {
      throw new Error(`SyncService: story ${storyId} not found while appending an operation log.`);
    }

    const id = ulid();
    await db.insert(operationLog).values({
      id,
      storyId,
      userId,
      operationVersion: nextOperationVersion,
      operationType: operationTypeEnum.enumValues.includes(update.type as any)
        ? (update.type as any)
        : 'update',
      entityType: update.entity,
      entityId: entityId || ulid(),
      payload,
      entityVersion: entityVersion ?? null,
      createdAt: update.operationTime ? new Date(update.operationTime) : new Date(),
    });

    return { id, operationVersion: nextOperationVersion };
  }

  /** Converte Dates em ISO para que a entidade atravesse o JSON da resposta intacta. */
  private serializeEntity(entity: Record<string, any>): Record<string, any> {
    const serialized: Record<string, any> = {};
    for (const [key, value] of Object.entries(entity)) {
      serialized[key] = value instanceof Date ? value.toISOString() : value;
    }
    return serialized;
  }

  async getUpdatesForStory(
    userId: string,
    storyId: string,
    lastOperationVersion: number,
    lastPublicFavoriteVersion: number = 0,
  ): Promise<{
    updates: StoryUpdate[];
    publicFavorites: (typeof favorites.$inferSelect)[];
    serverMaxOperationVersion: number;
    role: EffectiveStoryRole;
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
        (permission.permissionType === 'reader' || permission.permissionType === 'writer')
      ) {
        role = permission.permissionType;
      }
    }

    if (!role) {
      throw new AppError(403, 'Unauthorized: User does not have read permission for this story.');
    }

    if (story.favoriteBehavior === 'individual_public') {
      const repairedFavorites = await this.ensurePublicFavoriteOperationLogs(storyId);
      if (repairedFavorites.count > 0) {
        logger.info('Created missing operation logs for public favorites', {
          storyId,
          count: repairedFavorites.count,
        });
        eventManager.emit(`storyUpdate:${storyId}`, {
          type: 'story_update',
          storyId,
          updates: repairedFavorites.count,
          maxOperationVersion: repairedFavorites.maxOperationVersion,
        });
      }
    }

    const operationsAfterMainCursor = await db.query.operationLog.findMany({
      where: and(
        eq(operationLog.storyId, storyId),
        gt(operationLog.operationVersion, lastOperationVersion),
      ),
      orderBy: [operationLog.operationVersion],
      limit: MAX_SYNC_PULL_BATCH,
    });

    const visibleOperations = operationsAfterMainCursor.filter(
      (op) =>
        op.entityType !== 'Favorite' ||
        story.favoriteBehavior === 'individual_public' ||
        op.userId === userId,
    );

    // A cursor of its own makes it possible to publish favourites predating the behaviour change too.
    // The Map removes the natural overlap with the main query while both cursors are still close together.
    const historicalPublicFavorites =
      story.favoriteBehavior === 'individual_public'
        ? await db.query.operationLog.findMany({
            where: and(
              eq(operationLog.storyId, storyId),
              eq(operationLog.entityType, 'Favorite'),
              gt(operationLog.operationVersion, lastPublicFavoriteVersion),
            ),
            orderBy: [operationLog.operationVersion],
          })
        : [];
    const fetchedOperations = Array.from(
      new Map(
        [...visibleOperations, ...historicalPublicFavorites].map((operation) => [
          operation.id,
          operation,
        ]),
      ).values(),
    ).sort((a, b) => a.operationVersion - b.operationVersion);

    const updates: StoryUpdate[] = await Promise.all(
      fetchedOperations.map(async (op) => {
        const payloadAsRecord = op.payload as Record<string, any>; // Client's original payload

        let finalData: Record<string, any> | undefined;
        let finalChanges: Record<string, any> | undefined;
        let finalVersion: number | undefined;
        let operationTime: Date | undefined;

        // Determine the operation time based on the type
        // op.createdAt is a Date object from the DB.
        // update.operationTime is a string (if available from incoming client update).
        // For returned StoryUpdate, operationTime should be a string as per user's instruction.

        operationTime = op.createdAt; // Start with Date object from DB

        /**
         * The *entity's* version after this operation. `operationVersion` is the operation's position in the
         * story's sequence - a far larger number - and sending it in this field inflated the version the
         * client stores, making every conflict check pass.
         *
         * Rows written before the `entityVersion` column existed do not have the data; for those the old
         * behaviour is kept, because there is nowhere to take the correct value from.
         */
        const resultingEntityVersion = op.entityVersion ?? op.operationVersion;

        // --- Enrich data based on operation type ---
        if (op.operationType === 'create') {
          // For 'create', the client original payload contains the base data.
          // We need to add the generated fields from the operationLog.
          finalData = {
            ...payloadAsRecord, // Original client data
            createdAt: op.createdAt.toISOString(), // Convert to string for client
            updatedAt: op.createdAt.toISOString(), // For create, updatedAt is same as createdAt, convert to string
            version: resultingEntityVersion, // Versão da entidade após a criação
            isDeleted: false,
            deletedAt: null,
          };
          // Explicitly remove storyId if it was somehow in payloadAsRecord
          delete finalData.storyId;
          finalVersion = resultingEntityVersion;
        } else if (op.operationType === 'update') {
          // For 'update', the changes are directly from the payload.
          // We need to add the generated fields from the operationLog.
          finalChanges = {
            ...payloadAsRecord, // Original client changes
            updatedAt: op.createdAt.toISOString(), // The time of the update operation, convert to string
            version: resultingEntityVersion, // The version of the entity after this update
          };
          // Explicitly remove storyId if it was somehow in payloadAsRecord
          delete finalChanges.storyId;
          finalVersion = resultingEntityVersion;
        } else if (op.operationType === 'delete') {
          // For 'delete', payload contains id.
          // We need to reconstruct the deleted state from the operationLog.
          finalData = {
            id: op.entityId,
            isDeleted: true,
            updatedAt: op.createdAt.toISOString(), // The time of the delete operation, convert to string
            deletedAt: op.createdAt.toISOString(), // Convert to string
            version: resultingEntityVersion, // The version of the entity after this delete
          };
          finalVersion = resultingEntityVersion;
        }

        // Reconstruct the StoryUpdate object with added metadata
        if (op.operationType === 'create') {
          return {
            type: 'create',
            entity: op.entityType,
            id: op.entityId,
            data: finalData!,
            version: finalVersion,
            operationVersion: op.operationVersion,
            operationTime: operationTime ? operationTime.toISOString() : undefined, // CHANGED: Convert Date to ISO string
            originatingUser: op.userId, // Add userId
            operationId: op.id, // Permite ao cliente gravar a operação remota de forma idempotente
          } as CreateStoryUpdate;
        } else if (op.operationType === 'update') {
          return {
            type: 'update',
            entity: op.entityType,
            id: op.entityId,
            changes: finalChanges!,
            version: finalVersion,
            operationVersion: op.operationVersion,
            operationTime: operationTime ? operationTime.toISOString() : undefined, // CHANGED: Convert Date to ISO string
            originatingUser: op.userId, // Add userId
            operationId: op.id, // Permite ao cliente gravar a operação remota de forma idempotente
          } as UpdateStoryUpdate;
        } else if (op.operationType === 'delete') {
          return {
            type: 'delete',
            entity: op.entityType,
            id: op.entityId,
            version: finalVersion,
            operationVersion: op.operationVersion,
            operationTime: operationTime ? operationTime.toISOString() : undefined, // CHANGED: Convert Date to ISO string
            originatingUser: op.userId, // Add userId
            operationId: op.id, // Permite ao cliente gravar a operação remota de forma idempotente
          } as DeleteStoryUpdate;
        } else if (op.operationType === 'reorder') {
          const reorderPayload = op.payload as {
            reorderItems: { id: string; newIndex: number }[];
            reorderTarget?: 'StorySchemaField';
            schemaEntityType?: string;
          };

          if (op.entityType === 'Chapter') {
            // Reordering scenes within a chapter
            return {
              type: 'reorder',
              entity: 'Chapter',
              id: op.entityId, // The chapter ID whose scenes are reordered
              reorderItems: reorderPayload.reorderItems,
              version: resultingEntityVersion,
              operationVersion: op.operationVersion,
              operationTime: operationTime ? operationTime.toISOString() : undefined,
              originatingUser: op.userId,
              operationId: op.id,
            } as ChapterReorderingStoryUpdate;
          } else if (op.entityType === 'Story') {
            // Reordering chapters within a story
            return {
              type: 'reorder',
              entity: 'Story',
              id: op.entityId, // The story ID whose chapters are reordered
              reorderItems: reorderPayload.reorderItems,
              reorderTarget: reorderPayload.reorderTarget,
              schemaEntityType: reorderPayload.schemaEntityType,
              version: resultingEntityVersion,
              operationVersion: op.operationVersion,
              operationTime: operationTime ? operationTime.toISOString() : undefined,
              originatingUser: op.userId,
              operationId: op.id,
            } as StoryReorderingStoryUpdate;
          }
          throw new Error(`Unhandled reorder entity type: ${op.entityType}`);
        }
        throw new Error(`Unknown operation type: ${op.operationType}`);
      }),
    );
    // Fetch the current maximum operation version for the story
    const serverMaxOperationVersion =
      (
        await db
          .select({ maxVersion: max(operationLog.operationVersion) })
          .from(operationLog)
          .where(eq(operationLog.storyId, storyId))
      ).at(0)?.maxVersion || 0;

    // The log is still used for realtime and for the operations screen, but it is not a reliable source
    // for reconstructing snapshots imported before public favourites existed. Sending the authoritative
    // state of *other* users makes each client converge without touching a favourite of its own that is
    // still pending a push.
    const publicFavorites =
      story.favoriteBehavior === 'individual_public'
        ? await db.query.favorites.findMany({
            where: and(eq(favorites.storyId, storyId), ne(favorites.userId, userId)),
          })
        : [];

    return { updates, publicFavorites, serverMaxOperationVersion, role };
  }

  async getStoriesWithLastOperationVersionForUser(
    userId: string,
  ): Promise<{ storyId: string; lastOperationVersion: number; role: EffectiveStoryRole }[]> {
    const ownedStories = await db.query.stories.findMany({
      where: and(eq(stories.userId, userId), eq(stories.isDeleted, false)),
      columns: {
        id: true,
        lastOperationVersion: true,
      },
    });

    const permittedStories = await db.query.storyPermissions.findMany({
      where: and(
        eq(storyPermissions.userId, userId),
        eq(storyPermissions.isDeleted, false),
        or(
          eq(storyPermissions.permissionType, 'reader'),
          eq(storyPermissions.permissionType, 'writer'),
        ),
      ),
      with: {
        story: {
          columns: {
            id: true,
            lastOperationVersion: true,
            isDeleted: true,
          },
        },
      },
    });

    /**
     * Carries role alongside version, not just version: the client persists this role into its
     * local `stories.myRole` column the moment it creates the row for a story it just learned
     * about (see `StoryService.importFullStory`), so there's never a window where the row exists
     * server-linked but with an unknown role that a permissive default could mistake for owner.
     */
    const storyMap = new Map<string, { lastOperationVersion: number; role: EffectiveStoryRole }>();

    ownedStories.forEach((story) => {
      storyMap.set(story.id, {
        lastOperationVersion: story.lastOperationVersion,
        role: 'owner',
      });
    });

    permittedStories.forEach((permission) => {
      if (permission.story && !permission.story.isDeleted) {
        storyMap.set(permission.story.id, {
          lastOperationVersion: permission.story.lastOperationVersion,
          role: permission.permissionType,
        });
      }
    });

    return Array.from(storyMap.entries()).map(([storyId, { lastOperationVersion, role }]) => ({
      storyId,
      lastOperationVersion,
      role,
    }));
  }
}

export const syncService = new SyncService();
