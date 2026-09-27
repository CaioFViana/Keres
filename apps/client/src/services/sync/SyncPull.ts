import type {
  CreateStoryUpdate,
  DeleteStoryUpdate,
  Favorite,
  StoryUpdate,
  UpdateStoryUpdate,
} from '@keres/shared';
import { MAX_SYNC_PULL_BATCH, syncConflictValuesDiffer } from '@keres/shared';
import type { FavoriteBehavior } from '@keres/shared/entities/Story';
import { and, eq, inArray } from 'drizzle-orm';
import type { AppDrizzleClient, AppDrizzleTransaction } from '../../db';
import * as schema from '../../db/schema';
import type { OperationLogSelect } from '../../db/schema';
import { createULID } from '../../utils/entityUtils';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { withOpLogLock } from '../../utils/opLogMutex';
import type { ClientSyncEntityHandler } from '../entity-sync-handlers/ClientSyncEntityHandler';
import { getEntityTable, toEntityColumns } from '../entityTableRegistry';
import { findContestedFields, mergeLocalOperationPayloads } from '../SyncConflictService';
import {
  detachLandedOperation,
  raiseConflictsServerVersion,
  withoutDerivedPosition,
} from './syncConflictHelpers';
import type { SyncContext } from './SyncContext';
import type { FavoritesFingerprint } from './syncFavoritesFingerprint';
import { computeLocalFavoritesFingerprint } from './syncFavoritesFingerprint';
import { deriveBaseVersion, onlyMoves, onlyPlaces, throwIfSyncAborted } from './syncPure';

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

  /**
   * A remote operation moved the entity's version: conflicts still pending on the entity must
   * know, or resolving them would align the row to a version the server has left.
   */
  public async foldVersionIntoConflicts(update: StoryUpdate): Promise<void> {
    if (!update.id) return;
    await raiseConflictsServerVersion(
      this.context.db()!,
      this.context.storyId()!,
      update.entity,
      update.id,
      update.version,
    );
  }

  public async isOwnEchoedOperation(update: StoryUpdate): Promise<boolean> {
    if (!update.operationVersion) {
      return false;
    }
    if (update.clientOperationId && (await this.settleLostAck(update))) return true;
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
   * An operation of this device the server applied although its push answer never arrived: the
   * pull carries the device's own id for it. It is settled as its ack would have (synced, with
   * the server's version) and then skipped as an echo - reconciled as someone else's edit, it
   * would rebase the very operation it is, one version past the server.
   */
  private async settleLostAck(update: StoryUpdate): Promise<boolean> {
    const db = this.context.db()!;
    const op = await db.query.operationLogs.findFirst({
      where: and(
        eq(schema.operationLogs.id, update.clientOperationId!),
        eq(schema.operationLogs.storyId, this.context.storyId()!),
        eq(schema.operationLogs.isSynced, false),
      ),
    });
    if (!op) return false;
    await db
      .update(schema.operationLogs)
      .set({
        isSynced: true,
        serverOperationVersion: update.operationVersion,
        conflictState: null,
      })
      .where(eq(schema.operationLogs.id, op.id));
    // Held in a conflict meanwhile: that conflict was about whether it could land, and it did.
    if (
      op.conflictState !== null &&
      (await detachLandedOperation(db, this.context.storyId()!, op.id))
    ) {
      entityEventEmitter.emit('sync_conflicts_changed', this.context.storyId());
    }
    // As its ack would have: whatever still waits on the entity learns the server's version.
    await this.foldVersionIntoConflicts(update);
    return true;
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
      // The pull never carries `storyId` (the server strips it, and so does
      // `protectRemoteUpdate`), and a dozen handlers insert `data` as it comes: every remote
      // create of a scene, choice, item, route... failed its NOT NULL `story_id` - three
      // failures, then retired, so another device's new scenes never appeared here. The story
      // is known: the one being synchronized.
      const table = getEntityTable(update.entity);
      const scoped =
        table && 'storyId' in table
          ? ({
              ...createUpdate,
              data: { ...createUpdate.data, storyId: this.context.storyId() },
            } as CreateStoryUpdate)
          : createUpdate;
      await handler.applyCreate(this.context.storyId()!, scoped);
      return;
    }

    await handler.applyUpdate(this.context.storyId()!, {
      ...createUpdate,
      type: 'update',
      id: update.id!,
      changes: {
        // An arranged row's position follows its rank here; the create's copy is not written.
        ...withoutDerivedPosition(update.entity, createUpdate.data ?? {}),
        version:
          typeof createUpdate.data?.version === 'number'
            ? createUpdate.data.version
            : (createUpdate.version ?? 0),
      },
    } as UpdateStoryUpdate);
  }

  /**
   * Applies a remote deletion and brings the tombstone up to the server's: its content, when the
   * deletion carries it, and its version. The entity handlers only flip the flags - without this
   * the local row stayed one version behind the server's after every remote delete (a later
   * restore or edit rested on a stale base), and its fields kept whatever this device last had.
   * The version only ever moves up (`max`), so replaying an older deletion cannot drag it back.
   */
  public async applyRemoteDelete(
    update: DeleteStoryUpdate,
    handler: ClientSyncEntityHandler,
    runner: AppDrizzleClient | AppDrizzleTransaction = this.context.db(),
  ): Promise<void> {
    await handler.applyDelete(this.context.storyId(), update);
    const table = getEntityTable(update.entity);
    if (!table || !update.id) return;
    const tombstone = toEntityColumns(update.entity, update.data ?? {});
    delete tombstone.isDeleted;
    delete tombstone.deletedAt;
    // Exactly the server's (an older deletion replayed after a restore never reaches here -
    // `maskSupersededUpdate` drops it).
    const version = typeof update.version === 'number' ? { version: update.version } : {};
    if (Object.keys(tombstone).length === 0 && !('version' in version)) return;
    await runner
      .update(table)
      .set({ ...tombstone, ...version } as never)
      .where(eq((table as any).id, update.id));
  }

  /**
   * Brings a row's content in line with this device's own operation as the server recorded it.
   * Its version already holds - this device made the operation - but its fields may not: the
   * server records what it stored, which it may have normalized (a pair of ids sorted), a
   * keep-local deletion abandons the edits made before it, and a tombstone keeps whatever it had
   * while deleted. Only fields that differ are written. Only called with no local operation
   * pending on the entity, and with fields later history rewrote already masked out.
   */
  public async alignEchoedWholeRow(
    update: StoryUpdate,
    handler: ClientSyncEntityHandler,
  ): Promise<void> {
    if (update.type === 'delete') {
      if ((update as DeleteStoryUpdate).data) {
        await this.applyRemoteDelete(update as DeleteStoryUpdate, handler);
      }
      return;
    }
    if (update.type !== 'update' && update.type !== 'create') return;
    const written = withoutDerivedPosition(
      update.entity,
      update.type === 'create'
        ? { ...((update as CreateStoryUpdate).data ?? {}) }
        : { ...((update as UpdateStoryUpdate).changes ?? {}) },
    );
    const local = (await handler.getById(update.id ?? '')) as Record<string, unknown> | undefined;
    if (!local) return;
    const changes = Object.fromEntries(
      Object.entries(written).filter(
        ([field, value]) =>
          !['version', 'updatedAt', 'createdAt', 'id', 'storyId'].includes(field) &&
          field in local &&
          syncConflictValuesDiffer(value, local[field]),
      ),
    );
    if (Object.keys(changes).length === 0) return;
    await handler.applyUpdate(this.context.storyId(), {
      ...update,
      type: 'update',
      changes,
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
   *
   * `pendingLocalOps` holds every unsynchronized operation of the entity, including the ones already
   * parked in a pending conflict: a remote operation arriving while that conflict is open must fold
   * into it (`refreshServerSnapshot`), or resolving later would write back the snapshot taken when
   * the conflict opened - a server state that no longer exists.
   */
  public async reconcileRemoteUpdate(
    update: StoryUpdate,
    pendingLocalOps: OperationLogSelect[],
    handler: ClientSyncEntityHandler,
  ): Promise<{ conflicted: boolean }> {
    const entityId = update.id!;
    const fieldOps = pendingLocalOps;
    const pushableOps = fieldOps.filter((op) => op.conflictState === null);
    const hasOpenConflict = pushableOps.length < fieldOps.length;
    const refreshOpenConflict = async (serverValues: Record<string, any>) => {
      if (!hasOpenConflict) return;
      await this.context.conflictService().refreshServerSnapshot({
        storyId: this.context.storyId()!,
        entityType: update.entity,
        entityId,
        serverValues: withoutDerivedPosition(update.entity, serverValues),
        serverVersion: update.version ?? null,
      });
    };

    // The pending chain rests on the server version its first operation names, and every path that
    // sets that base (a pull, a silent merge, a resolution) brought the row to the server's state at
    // it. A remote operation at or below the base is history this row already holds - typically one a
    // lagging pull delivers after a silent merge absorbed it from the server's row. Reconciling it
    // again would dispute the user's own newer edits with a value they already saw and replaced.
    // Deletions excepted: a deletion skipped as history is lost for good (its tombstone never lands,
    // or the row stays alive), while held here already it settles harmlessly below.
    const pushableBase = pushableOps[0]
      ? deriveBaseVersion(parseLocalOpPayload(pushableOps[0].payload) ?? {})
      : undefined;
    if (
      !hasOpenConflict &&
      update.type !== 'delete' &&
      typeof update.version === 'number' &&
      typeof pushableBase === 'number' &&
      update.version <= pushableBase
    ) {
      return { conflicted: false };
    }
    const rebaseOnto = async (version: number | undefined) => {
      // The rebase only ever moves forward: a remote operation older than the local base (history
      // the device already absorbed, see `maskSupersededUpdate`) must not drag the chain back.
      // Operations parked in a conflict are not rebased - the resolution rebases what it keeps.
      if (typeof version === 'number' && (pushableBase === undefined || version > pushableBase)) {
        await this.rebasePendingOperations(pushableOps, version);
      }
    };

    const localWantsDelete = fieldOps.some((op) => op.operationType === 'delete');
    const localValues = mergeLocalOperationPayloads(fieldOps);
    const localOperationIds = fieldOps.map((op) => op.id);
    const localOperationType = localWantsDelete
      ? 'delete'
      : fieldOps.some((op) => op.operationType === 'create')
        ? 'create'
        : 'update';

    const firstOpSnapshot = fieldOps[0] ? parseLocalOpPayload(fieldOps[0].payload) : null;
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
        serverValues: serverValues ? withoutDerivedPosition(update.entity, serverValues) : null,
        clientVersion: fieldOps[0]
          ? await this.deriveFreshClientVersion(fieldOps[0], firstOpSnapshot)
          : null,
        serverVersion: update.version ?? null,
        message:
          update.type === 'delete'
            ? `Server deleted ${update.entity} ${entityId} while it had unsynced local edits.`
            : `Server and local changes overlap on ${update.entity} ${entityId}.`,
      });

    if (update.type === 'delete') {
      if (localWantsDelete) {
        // Both sides deleted: the same intent, nothing to decide.
        await this.applyRemoteDelete(update as DeleteStoryUpdate, handler);
        await refreshOpenConflict({ ...(update as DeleteStoryUpdate).data, isDeleted: true });
        return { conflicted: false };
      }
      if (!hasOpenConflict && onlyMoves(update.entity, localValues)) {
        // Only a move of the row waited here: the deletion loses nothing of it, so it lands and
        // the move is dropped - asking about the place of something gone would decide nothing.
        await this.context
          .db()!
          .update(schema.operationLogs)
          .set({ conflictState: 'abandoned', isSynced: true })
          .where(inArray(schema.operationLogs.id, localOperationIds));
        await this.applyRemoteDelete(update as DeleteStoryUpdate, handler);
        return { conflicted: false };
      }
      // The remote deletion is deliberately not applied: discarding what the person wrote here would take
      // away their chance to recover the entity.
      // The tombstone the deletion carries is the snapshot: accepting the deletion then leaves
      // this row equal to the server's, not holding the abandoned local values.
      await recordConflict('deleted_on_server', {
        ...(update as DeleteStoryUpdate).data,
        isDeleted: true,
        version: update.version,
      });
      return { conflicted: true };
    }

    // Only scalar types reach the merge below: delete is handled above. An unknown type carries no
    // interpretable values - rebasing onto nothing would silently advance past it, so fail closed
    // instead. Unreachable through the batch applier (it stops unknown types before dispatch);
    // this guards future direct callers.
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
      // A remote edit that only moved the row changes nothing the deletion would lose. The row
      // still takes the new place: should the deletion be given up later, it comes back where the
      // server has it.
      if (onlyPlaces(update.entity, remoteValues)) {
        const placement = Object.fromEntries(
          Object.entries(remoteValues).filter(([key]) => key !== 'version'),
        );
        if (Object.keys(placement).length > 0) {
          await handler.applyUpdate(this.context.storyId()!, {
            ...update,
            type: 'update',
            id: entityId,
            changes: placement,
          } as UpdateStoryUpdate);
        }
        await rebaseOnto(update.version);
        await refreshOpenConflict(remoteValues);
        return { conflicted: false };
      }
      await recordConflict('edited_on_server', remoteValues);
      return { conflicted: true };
    }

    // A place is never a dispute: this device's rank reaches the server after the remote one, and
    // the last move to land is the row's place everywhere - so a pending local rank stays.
    const contestedFields = findContestedFields(localValues, remoteValues).filter(
      (field) => field !== 'rank',
    );
    // `version` is not merged as a field: with local work pending, the row's version belongs to the
    // local chain, and the rebase below is what moves it (to the remote version plus the chain).
    // Writing the remote version here regressed the row whenever the rebase rightly did not run.
    const mergeableEntries = Object.entries(remoteValues).filter(
      ([key]) =>
        key !== 'version' &&
        !contestedFields.includes(key) &&
        !(key === 'rank' && 'rank' in localValues),
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
      await rebaseOnto(update.version);
      await refreshOpenConflict(remoteValues);
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
}
