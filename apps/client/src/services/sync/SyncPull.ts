import type {
  ChapterReorderingStoryUpdate,
  CreateStoryUpdate,
  DeleteStoryUpdate,
  Favorite,
  StoryReorderingStoryUpdate,
  StoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import {
  encodeReorderOperationPayload,
  MAX_SYNC_PULL_BATCH,
  sameReorderArrangement,
} from '@keres/shared';
import type { FavoriteBehavior } from '@keres/shared/entities/Story';
import { and, eq } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';
import type { OperationLogSelect } from '../../db/schema';
import { createULID } from '../../utils/entityUtils';
import { withOpLogLock } from '../../utils/opLogMutex';
import type { ClientSyncEntityHandler } from '../entity-sync-handlers/ClientSyncEntityHandler';
import { findContestedFields, mergeLocalOperationPayloads } from '../SyncConflictService';
import { applyReorderToLocalDb } from './applyReorderToLocalDb';
import type { SyncContext } from './SyncContext';
import type { FavoritesFingerprint } from './syncFavoritesFingerprint';
import { computeLocalFavoritesFingerprint } from './syncFavoritesFingerprint';
import { deriveBaseVersion, throwIfSyncAborted } from './syncPure';

interface SyncPullOptions {
  context: SyncContext;
  rebasePendingOperations: (
    operations: OperationLogSelect[],
    newEntityVersion?: number,
  ) => Promise<void>;
}

export type SyncPullRole = 'owner' | 'writer' | 'reader';

/** Pages of pull batches per cycle; a larger backlog continues on the next cycle. */
export const PULL_MAX_PAGES = 20;

export interface FetchRemoteUpdatesInput {
  /** Highest server operation already applied; pages start after it. */
  lastSyncedLog: number;
  lastPublicFavoriteLog: number;
  favoriteBehavior: FavoriteBehavior;
  /** Reported when no page carries a role (the local row's offline-first default). */
  fallbackRole: SyncPullRole;
  /** Page ceiling for this fetch; defaults to PULL_MAX_PAGES. */
  maxPages?: number;
}

export interface FetchRemoteUpdatesResult {
  updates: StoryUpdate[];
  publicFavorites: Favorite[];
  role: SyncPullRole;
}

interface PullPageResponse {
  updates: StoryUpdate[];
  publicFavorites?: Favorite[];
  serverMaxOperationVersion: number;
  role: 'owner' | 'writer' | 'reader';
  favoritesFingerprint?: FavoritesFingerprint;
}

/**
 * Which row set a reorder disputes. Two reorders overlap only when their keys match: chapters
 * and events own independent index spaces, stats and schema fields own their own tables, and a
 * schema-field order is per entity type. Chapters reorder scenes only.
 *
 * `null` means "cannot tell" (an unrecognised target, or a schema-field order without its entity
 * type) and always disputes, fail-closed: an order that cannot be proven disjoint must not slip
 * past as one.
 */
function reorderDisputeKey(
  entity: string,
  reorderTarget: unknown,
  schemaEntityType: unknown,
): string | null {
  if (entity !== 'Story') return 'scenes';
  if (reorderTarget === 'StorySchemaField') {
    return typeof schemaEntityType === 'string' && schemaEntityType.length > 0
      ? `schema-field:${schemaEntityType}`
      : null;
  }
  if (reorderTarget === undefined) return 'chapters';
  return reorderTarget === 'Stat' || reorderTarget === 'Event' ? reorderTarget : null;
}

/** Parses a local op payload without ever throwing; null means corrupted or not an object. */
function parseLocalOpPayload(payload: string): Record<string, any> | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : null;
  } catch {
    return null;
  }
}

/** Applies remote operations while preserving and surfacing unsent local edits. */
export class SyncPull {
  private readonly context: SyncContext;
  private readonly rebasePendingOperations: SyncPullOptions['rebasePendingOperations'];

  public constructor(options: SyncPullOptions) {
    this.context = options.context;
    this.rebasePendingOperations = options.rebasePendingOperations;
  }

  /**
   * Fetches every remote update since `lastSyncedLog`, following pages until one comes back
   * incomplete so as not to leave a large backlog for the next cycle.
   */
  public async fetchRemoteUpdates(
    input: FetchRemoteUpdatesInput,
  ): Promise<FetchRemoteUpdatesResult> {
    const storyId = this.context.storyId();
    const client = this.context.client();
    const signal = this.context.abortSignal();
    const { lastSyncedLog, lastPublicFavoriteLog } = input;

    // The roster checksum lets a public story's server skip re-sending every favorite on
    // every pull. It is computed from the local table (no new persisted state): sending it
    // only when the local story already publishes keeps private-story pulls byte-identical
    // to before, and a story that just turned public bootstraps through the legacy
    // always-send path until its Story op arrives here.
    let pageFingerprint: FavoritesFingerprint | null =
      input.favoriteBehavior === 'individual_public'
        ? await computeLocalFavoritesFingerprint(this.context.db(), storyId)
        : null;

    console.log(`Pulling remote updates for story ${storyId} since version ${lastSyncedLog}...`);
    const remoteUpdates: StoryUpdate[] = [];
    let publicFavorites: Favorite[] = [];
    let role = input.fallbackRole;
    let pullCursor = lastSyncedLog;
    let pageFavoriteCursor = lastPublicFavoriteLog;
    const maxPages = input.maxPages ?? PULL_MAX_PAGES;
    let pagesFetched = 0;
    let backlogExhausted = false;
    for (let page = 0; page < maxPages; page += 1) {
      pagesFetched = page + 1;
      throwIfSyncAborted(signal);
      const fingerprintQuery =
        pageFingerprint !== null
          ? `&favoritesCount=${pageFingerprint.count}&favoritesMaxVersion=${pageFingerprint.maxVersion}`
          : '';
      const pullResponse = await client.get<PullPageResponse>(
        `/sync/${storyId}/pull?lastOperationVersion=${pullCursor}&lastPublicFavoriteVersion=${pageFavoriteCursor}${fingerprintQuery}`,
        { signal },
      );
      const pageUpdates = pullResponse.data.updates ?? [];
      // Once a page has delivered the roster, the following pages of the same cycle adopt
      // the server's own numbers instead of re-sending the stale pre-pull ones - without
      // this, every page of a large backlog would repeat the full snapshot.
      if (pullResponse.data.favoritesFingerprint) {
        pageFingerprint = pullResponse.data.favoritesFingerprint;
      }
      publicFavorites = pullResponse.data.publicFavorites ?? publicFavorites;
      if (pullResponse.data.role) role = pullResponse.data.role;
      remoteUpdates.push(...pageUpdates);
      if (pageUpdates.length === 0) {
        backlogExhausted = true;
        break;
      }
      pullCursor = Math.max(
        pullCursor,
        ...pageUpdates.map((update) => update.operationVersion || 0),
      );
      // The favorites cursor advances within the cycle too: without this every page re-fetches
      // the same favorite rows until the page ceiling. It tracks delivered favorites only - the
      // page max may belong to a main row sitting above undelivered favorites, and adopting it
      // would skip them.
      const deliveredFavoriteVersions = pageUpdates
        .filter((update) => update.entity === 'Favorite')
        .map((update) => update.operationVersion || 0);
      if (deliveredFavoriteVersions.length > 0) {
        pageFavoriteCursor = Math.max(pageFavoriteCursor, ...deliveredFavoriteVersions);
      }
      if (pageUpdates.length < MAX_SYNC_PULL_BATCH) {
        backlogExhausted = true;
        break;
      }
    }
    // The ceiling warning only fires when paging stopped for running out of pages: a short
    // final page proves the backlog is drained, even on the last allowed page.
    if (pagesFetched >= maxPages && !backlogExhausted) {
      console.log(
        `Pull reached the ${maxPages}-page ceiling for story ${storyId} with ` +
          `${remoteUpdates.length} updates collected; any remaining backlog continues on the next cycle.`,
      );
    }
    return { updates: remoteUpdates, publicFavorites, role };
  }

  public async isOwnEchoedOperation(update: StoryUpdate): Promise<boolean> {
    if (!update.operationVersion) {
      return false;
    }
    // Entity-scoped, not version-only: a synced op carrying a stale or foreign version must
    // never mask a concurrent operation that happens to sit at that version - versions are
    // unique per story, so a true echo always matches the entity too.
    const existing = await this.context.db()!.query.operationLogs.findFirst({
      where: and(
        eq(schema.operationLogs.storyId, this.context.storyId()!),
        eq(schema.operationLogs.serverOperationVersion, update.operationVersion),
        eq(schema.operationLogs.isSynced, true),
        eq(schema.operationLogs.entityType, update.entity),
        eq(schema.operationLogs.entityId, update.id ?? ''),
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
   *
   * The local `operationVersion` comes from the story's own counter (same lock as local writers),
   * NOT from the server: the column holds a single per-story sequence, while the server's number
   * lives in `serverOperationVersion`. Numbering recorded rows with server versions would collide
   * with local rows once both counters advance past the import point (same base, independent
   * increments) and trip the unique index. A re-recorded op (same server id) is still skipped by
   * `onConflictDoNothing`, at the cost of a harmless gap in the counter.
   */
  public async recordRemoteOperationLocally(
    update: StoryUpdate,
    tx?: AppDrizzleTransaction,
  ): Promise<void> {
    const payloadToStore =
      update.type === 'create'
        ? update.data
        : update.type === 'update'
          ? update.changes
          : update.type === 'reorder'
            ? encodeReorderOperationPayload(update)
            : { id: update.id }; // For delete, just store the ID

    const storyId = this.context.storyId()!;
    // The insert and the counter bump commit together: a crash between them re-issues a taken
    // version on the next record. A caller holding the op-log lock and its own transaction (the
    // pull applier, covering apply+record) passes the transaction in; standalone callers take
    // the lock and a transaction of their own. The lock is NOT reentrant, so the two paths
    // never mix: a transaction given means the caller already holds the lock.
    if (tx) {
      await this.insertRemoteRecord(tx, storyId, update, payloadToStore);
      return;
    }
    const db = this.context.db()!;
    await withOpLogLock(storyId, async () => {
      await db.transaction(async (inner) => {
        await this.insertRemoteRecord(inner, storyId, update, payloadToStore);
      });
    });
  }

  private async insertRemoteRecord(
    runner: AppDrizzleClient | AppDrizzleTransaction,
    storyId: string,
    update: StoryUpdate,
    payloadToStore: unknown,
  ): Promise<void> {
    const currentStory = await runner.query.stories.findFirst({
      where: eq(schema.stories.id, storyId),
      columns: { lastOperationLog: true },
    });
    const nextOperationVersion = (currentStory?.lastOperationLog || 0) + 1;

    await runner
      .insert(schema.operationLogs)
      .values({
        id: update.operationId || createULID(),
        storyId,
        userId: update.originatingUser || 'unknown',
        operationVersion: nextOperationVersion,
        operationType: update.type,
        entityType: update.entity,
        entityId: update.id!,
        payload: JSON.stringify(payloadToStore),
        createdAt: update.operationTime ? new Date(update.operationTime) : new Date(),
        isSynced: true, // Mark as synced because it came from the server
        serverOperationVersion: update.operationVersion || 0,
      })
      .onConflictDoNothing();

    await runner
      .update(schema.stories)
      .set({ lastOperationLog: nextOperationVersion })
      .where(eq(schema.stories.id, storyId));
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

    const firstOpSnapshot = parseLocalOpPayload(pendingLocalOps[0].payload);
    const recordConflict = async (
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
        clientVersion: await this.deriveFreshClientVersion(pendingLocalOps[0], firstOpSnapshot),
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

    // Only scalar types reach the merge below: reorder returns earlier, delete is handled
    // above. An unknown type carries no interpretable values - rebasing onto nothing would
    // silently advance past it, so fail closed instead. Unreachable through the batch applier
    // (it stops unknown types before dispatch); this guards future direct callers.
    // (Hoisted: after the checks below, the type union narrows `update` to `never` - which is
    // exactly the point, since only foreign runtime data can arrive here.)
    const remoteType: string = update.type;
    const remoteEntity: string = update.entity;
    if (update.type !== 'create' && update.type !== 'update') {
      throw new Error(
        `SyncPull: cannot reconcile remote operation type '${remoteType}' for ${remoteEntity} ${entityId}.`,
      );
    }
    const remoteValues: Record<string, any> =
      update.type === 'create'
        ? { ...(update as CreateStoryUpdate).data }
        : { ...(update as UpdateStoryUpdate).changes };

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
   * The base the conflicted edit rests on, re-read from the database: an earlier remote update in
   * the same batch may have rebased these ops already (the rebase writes only to the DB), leaving
   * the in-memory snapshot stale. Falls back to the snapshot when the row is gone, and to null when
   * the payload cannot be parsed at all - never throws. Only the version is re-read; the merge above
   * is untouched, since version is bookkeeping the merge already ignores.
   */
  private async deriveFreshClientVersion(
    op: OperationLogSelect,
    snapshot: Record<string, any> | null,
  ): Promise<number | null> {
    try {
      const row = await this.context.db()!.query.operationLogs.findFirst({
        where: eq(schema.operationLogs.id, op.id),
        columns: { payload: true },
      });
      const fresh = row ? parseLocalOpPayload(row.payload) : null;
      const version = fresh ? deriveBaseVersion(fresh) : undefined;
      if (typeof version === 'number') return version;
    } catch {
      // Fall through to the in-memory snapshot below.
    }
    if (!snapshot) {
      console.warn(
        `Local operation ${op.id} has a payload that cannot be parsed; recording the conflict without a client version.`,
      );
      return null;
    }
    return deriveBaseVersion(snapshot) ?? null;
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
    // A remote order with no items disputes nothing: it is vacuous history (the server
    // refuses to log new ones), not a competing arrangement, so there is no conflict to
    // record and nothing to apply. The pending ops stay queued untouched.
    if (!update.reorderItems || update.reorderItems.length === 0) {
      return { conflicted: false };
    }

    // Only pending reorders over the SAME row set dispute this one: a queued Stat order
    // and an incoming chapter order touch disjoint rows, so the remote one applies directly
    // and the queued one still pushes normally (the server's stale-base resend accepts it,
    // since the remote order left its rows alone). Anything unrecognised disputes,
    // fail-closed.
    const remoteKey = reorderDisputeKey(
      update.entity,
      (update as StoryReorderingStoryUpdate).reorderTarget,
      (update as StoryReorderingStoryUpdate).schemaEntityType,
    );
    const disputingReorderOps = pendingLocalOps.filter((op) => {
      if (op.operationType !== 'reorder') return false;
      if (remoteKey === null) return true;
      const payload = parseLocalOpPayload(op.payload);
      if (!payload) {
        // Fail closed: an unreadable order cannot be proven disjoint.
        console.warn(
          `Local reorder operation ${op.id} has a payload that cannot be parsed; treating it as disputing the remote order.`,
        );
        return true;
      }
      const localKey = reorderDisputeKey(
        op.entityType,
        payload.reorderTarget,
        payload.schemaEntityType,
      );
      return localKey === null || localKey === remoteKey;
    });
    const localReorderOp = disputingReorderOps[0];

    if (!localReorderOp) {
      // What is pending on this entity is of another kind (renaming a chapter, say) or an
      // order over a disjoint row set - it does not conflict with the order coming from the
      // server, which can be applied directly.
      await applyReorderToLocalDb(this.context.db()!, update, new Date(update.operationTime!));
      return { conflicted: false };
    }

    // The remote order restates a pending local reorder - typically our own op coming back
    // after its push response was lost. Absorbing it (rather than recording a conflict the
    // user would have to dismiss for their own echo) is what lets the push resend succeed
    // idempotently on the server; the op stays pending so that resend still happens.
    //
    // Absorbing applies nothing: the local rows already hold this arrangement (the pending
    // op was applied locally when the user acted) or a newer one (a chained reorder still
    // queued behind it) - writing the remote order here would either churn versions for no
    // effect or silently regress the newer local order, which no later echo would repair.
    const restatesPendingOrder = disputingReorderOps.some((op) => {
      const payload = parseLocalOpPayload(op.payload);
      if (!payload) {
        // An unreadable order cannot be proven an echo of the remote one.
        console.warn(
          `Local reorder operation ${op.id} has a payload that cannot be parsed; skipping the echo comparison.`,
        );
        return false;
      }
      const items = (payload as { reorderItems?: unknown }).reorderItems;
      return Array.isArray(items) && sameReorderArrangement(items, update.reorderItems ?? []);
    });
    if (restatesPendingOrder) {
      return { conflicted: false };
    }

    const parsedLocalPayload = parseLocalOpPayload(localReorderOp.payload);
    if (!parsedLocalPayload) {
      console.warn(
        `Local reorder operation ${localReorderOp.id} has a payload that cannot be parsed; recording the conflict with an empty local order.`,
      );
    }
    const localPayload = parsedLocalPayload ?? {};
    // Every disputing reorder joins the conflict, not just the first: the resolvers already
    // chain multiple ids (rebase in version order, or abandon all), so one resolution settles
    // the whole dispute instead of leaving the rest to conflict again on the next push. The
    // recorded values stay representative of the first dispute - reorder item lists do not
    // merge by field, and the resolvers work from the operation payloads, not these values.
    await this.context.conflictService().recordConflict({
      storyId: this.context.storyId()!,
      entityType: update.entity,
      entityId,
      reason: 'concurrent_edit',
      localOperationType: 'reorder',
      localOperationIds: disputingReorderOps.map((op) => op.id),
      localValues: { reorderItems: localPayload.reorderItems ?? [] },
      serverValues: {
        reorderItems: update.reorderItems,
        reorderTarget: (update as StoryReorderingStoryUpdate).reorderTarget,
      },
      // The parsed payload (already warned about above when unreadable) is the snapshot fallback;
      // the re-read from the DB wins whenever an earlier update in this batch rebased it.
      clientVersion: await this.deriveFreshClientVersion(localReorderOp, parsedLocalPayload),
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
