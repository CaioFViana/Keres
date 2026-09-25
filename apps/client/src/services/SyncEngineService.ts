import type { CreateStoryUpdate, EffectiveStoryRole, Favorite, StoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import type { ServerSelect } from '../db/schema';
import type { KeresAxiosInstance, TokenProvider } from './apiClient';
import {
  isAbortError,
  isNotFoundError,
  isOfflineError,
  isProtocolMismatchError,
} from './apiClient';
import type { ClientSyncEntityHandler } from './entity-sync-handlers/ClientSyncEntityHandler';
import type { ServerService } from './ServerService';
import type { SyncConflictService } from './SyncConflictService';
import { type ServerStoryPreview, type StoryUploadResult } from './sync/StoryTransfer';
import { SyncScheduler, type SyncCycleOutcome } from './sync/SyncScheduler';
import type { SyncContext } from './sync/SyncContext';
import { SyncPull, type SyncPullRole } from './sync/SyncPull';
import { SyncPullApply } from './sync/SyncPullApply';
import { SyncPush } from './sync/SyncPush';
import { SyncMedia } from './sync/SyncMedia';
import type { SyncNotifier } from './sync/SyncNotifier';
import { protectRemoteUpdate, throwIfSyncAborted } from './sync/syncPure';
import { FAVORITE_TARGET_EVENTS } from './sync/syncEvents';

export type { ServerStoryPreview } from './sync/StoryTransfer';
export { OFFLINE_RETRY_MS, SYNC_INTERVAL_MS } from './sync/SyncScheduler';

export type SyncEngineLifecycle = 'unbound' | 'idle' | 'active' | 'running';

export interface SyncEventPublisher {
  emit(event: string, ...args: unknown[]): void;
}

export interface SyncTokenProvider extends TokenProvider {
  setGetServerById(getServerById: ServerService['getServerById']): void;
}

export interface SyncEngineDependencies {
  notifier: SyncNotifier;
  events: SyncEventPublisher;
  tokenProvider: SyncTokenProvider;
  createClient(baseURL?: string): KeresAxiosInstance;
  createEntityHandlers(): Map<string, ClientSyncEntityHandler>;
  createConflictService(db: AppDrizzleClient): SyncConflictService;
  createServerService(db: AppDrizzleClient): ServerService;
  fetchServerStoryPreviews(server: ServerSelect): Promise<ServerStoryPreview[]>;
  downloadAndImportStory(
    db: AppDrizzleClient | null,
    queriedServerId: string,
    storyId: string,
    userId: string,
    role: EffectiveStoryRole,
  ): Promise<void>;
  uploadNewStoryToServer(
    db: AppDrizzleClient | null,
    storyId: string,
    server: ServerSelect,
    userId: string,
  ): Promise<StoryUploadResult>;
}

export class SyncEngineService {
  private storyId: string | null = null;
  /**
   * Held because media transfer does not go through Axios (see `MediaSyncService`) and needs the server
   * to build its authentication on its own.
   */
  private activeServer: ServerSelect | null = null;
  private client: KeresAxiosInstance;
  private scheduler: SyncScheduler;
  private pull: SyncPull;
  private push: SyncPush;
  private media: SyncMedia;
  private _db: AppDrizzleClient | null = null;
  private _conflictService: SyncConflictService | null = null;
  private entityHandlers: Map<string, ClientSyncEntityHandler>;
  private pullApply: SyncPullApply;
  private contextTransition: Promise<void> = Promise.resolve();
  private pendingContextTransitions = 0;
  /**
   * Bindings captured at the start of an active cycle. Context switches after a
   * `stopAndWait` timeout must not redirect an in-flight cycle onto another story.
   */
  private cycleBinding: {
    storyId: string;
    db: AppDrizzleClient;
    client: KeresAxiosInstance;
    activeServer: ServerSelect | null;
    signal: AbortSignal;
  } | null = null;

  public constructor(private readonly dependencies: SyncEngineDependencies) {
    this.client = dependencies.createClient();
    this.scheduler = new SyncScheduler({
      readiness: () => ({
        storyId: this.storyId,
        hasServer: Boolean(this.client.defaults.baseURL),
        hasDatabase: Boolean(this._db),
      }),
      performSync: (signal) => this.performSync(signal),
    });
    this.entityHandlers = dependencies.createEntityHandlers();
    const syncContext: SyncContext = {
      db: () => this.resolveCycleDb(),
      storyId: () => this.resolveCycleStoryId(),
      client: () => this.resolveCycleClient(),
      conflictService: () => this.conflictService,
      notifier: () => this.dependencies.notifier,
      abortSignal: () => {
        if (!this.cycleBinding) {
          throw new Error('Sync abort signal is not available outside an active cycle.');
        }
        return this.cycleBinding.signal;
      },
    };
    this.push = new SyncPush(syncContext);
    this.pull = new SyncPull({
      context: syncContext,
      rebasePendingOperations: (operations, version) =>
        this.push.rebasePendingOperations(operations, version),
    });
    this.pullApply = new SyncPullApply({
      pull: this.pull,
      getPendingOperationsByEntity: () => this.push.getPendingOperationsByEntity(),
      entityHandlers: this.entityHandlers,
      notifier: dependencies.notifier,
      events: dependencies.events,
    });
    this.media = new SyncMedia({
      db: () => this.cycleBinding?.db ?? this._db,
      storyId: () => this.cycleBinding?.storyId ?? this.storyId,
      server: () => this.cycleBinding?.activeServer ?? this.activeServer,
      client: () => this.resolveCycleClient(),
    });
  }

  private resolveCycleDb(): AppDrizzleClient {
    const db = this.cycleBinding?.db ?? this._db;
    if (!db) throw new Error('Sync database is not configured.');
    return db;
  }

  private resolveCycleStoryId(): string {
    const storyId = this.cycleBinding?.storyId ?? this.storyId;
    if (!storyId) throw new Error('Sync story is not configured.');
    return storyId;
  }

  private resolveCycleClient(): KeresAxiosInstance {
    return this.cycleBinding?.client ?? this.client;
  }

  public get lifecycle(): SyncEngineLifecycle {
    if (!this._db) return 'unbound';
    if (!this.storyId || !this.activeServer) return 'idle';
    return this.scheduler.isRunning ? 'running' : 'active';
  }

  public bindDatabase(dbInstance: AppDrizzleClient): Promise<void> {
    if (this._db === dbInstance && this.pendingContextTransitions === 0) {
      return Promise.resolve();
    }
    return this.applyContextTransition(() => {
      this._db = dbInstance;
      this._conflictService = null; // Recreated on demand, already bound to the new database.
      // Propagate the db instance to all registered handlers
      this.entityHandlers.forEach((handler) => handler.setDb(dbInstance));

      // Authentication resolves the server through the database bound to this engine instance.
      const serverService = this.dependencies.createServerService(dbInstance);
      this.dependencies.tokenProvider.setGetServerById(serverService.getServerById);
    });
  }

  public activateStory(storyId: string, server: ServerSelect): Promise<void> {
    if (!storyId) throw new Error('SyncEngineService: a story is required for activation.');
    if (!server.url) throw new Error('SyncEngineService: a server URL is required for activation.');

    return this.applyContextTransition(() => {
      if (!this._db) {
        throw new Error('SyncEngineService: bind the database before activating a story.');
      }
      this.storyId = storyId;
      this.activeServer = server;
      this.client = this.dependencies.createClient(server.url);
      this.client.setTokenProvider(this.dependencies.tokenProvider);
      this.client.setActiveServer(server);
      // Per-story state must not leak across stories: failure counts are keyed by per-story
      // operation versions and the backoff streak belongs to the previous story's server.
      this.pullApply.reset();
      this.scheduler.resetBackoff();
      this.scheduler.resume();
      console.log(`SyncEngineService activated for story ${storyId} with server: ${server.url}`);
    });
  }

  public startSync(intervalTimeMs?: number): void {
    this.scheduler.start(intervalTimeMs);
  }

  public requestSync(_reason: 'websocket' | 'initial' | 'local-change' = 'websocket'): void {
    this.scheduler.request();
  }

  public stopSync(): void {
    this.scheduler.stop();
  }

  public deactivateStory(): Promise<void> {
    return this.applyContextTransition(() => this.clearStoryContext());
  }

  public reset(): Promise<void> {
    return this.applyContextTransition(() => {
      this.clearStoryContext();
      this._db = null;
      this._conflictService = null;
      this.media.reset();
      console.log('Sync engine has been reset, database instance cleared.');
    });
  }

  public fetchServerStoryPreviews(server: ServerSelect): Promise<ServerStoryPreview[]> {
    return this.dependencies.fetchServerStoryPreviews(server);
  }

  public downloadAndImportStory(
    queriedServerId: string,
    storyId: string,
    userId: string,
    role: EffectiveStoryRole,
  ): Promise<void> {
    return this.dependencies.downloadAndImportStory(
      this._db,
      queriedServerId,
      storyId,
      userId,
      role,
    );
  }

  public uploadNewStoryToServer(
    storyId: string,
    server: ServerSelect,
    userId: string,
  ): Promise<StoryUploadResult> {
    return this.dependencies.uploadNewStoryToServer(this._db, storyId, server, userId);
  }

  private get conflictService(): SyncConflictService {
    if (!this._conflictService) {
      if (!this._db) {
        throw new Error(
          'SyncEngineService: cannot use the conflict service before bindDatabase().',
        );
      }
      this._conflictService = this.dependencies.createConflictService(this._db);
    }
    return this._conflictService;
  }

  /**
   * Serializes context mutations and keeps the active cycle on one stable set of dependencies.
   * Returns false when `stopAndWait` times out: live pointers stay put so an abandoned cycle
   * cannot observe a newer story/server/database. Callers can retry after the cycle ends.
   */
  private transitionContext(change: () => void): Promise<boolean> {
    this.scheduler.stop();
    this.pendingContextTransitions += 1;
    const run = (async () => {
      await this.contextTransition.catch(() => undefined);
      const stopResult = await this.scheduler.stopAndWait();
      if (stopResult === 'timed_out') {
        this.scheduler.resume();
        return false;
      }
      change();
      return true;
    })();
    this.contextTransition = run.then(
      () => undefined,
      () => undefined,
    );
    return run.finally(() => {
      this.pendingContextTransitions -= 1;
    });
  }

  private applyContextTransition(change: () => void): Promise<void> {
    return this.transitionContext(change).then((applied) => {
      if (!applied) {
        throw new Error(
          'SyncEngineService: context transition timed out while a sync cycle was still running.',
        );
      }
    });
  }

  private clearStoryContext(): void {
    this.storyId = null;
    this.activeServer = null;
    this.client.defaults.baseURL = undefined;
    this.pullApply.reset();
  }

  /**
   * Used only by the active cycle itself; awaiting its own idle state would deadlock.
   * When an abandoned cycle (still bound to an older story after a timed-out context
   * switch) decides to stop, it must not clear the newly activated story.
   */
  private deactivateStoryFromActiveCycle(cycleStoryId?: string): void {
    if (cycleStoryId && this.storyId && this.storyId !== cycleStoryId) {
      console.log(
        `Sync cycle for ${cycleStoryId} ending without clearing active story ${this.storyId}.`,
      );
      return;
    }
    this.scheduler.stop();
    this.clearStoryContext();
  }

  private throwIfCycleAborted(signal: AbortSignal): void {
    throwIfSyncAborted(signal);
  }

  /**
   * Runs one full pull/push cycle: 'offline' when the server was unreachable, 'failed' when the
   * pull or the push failed, 'ok' when both phases ran (even with conflicts or skipped operations).
   *
   * Versioning note: every local service increments `version` by exactly 1 and writes the
   * *resulting* version into the operation's payload. The server needs the base, not the
   * result: it is by comparing the base with the version it holds now that it discovers
   * whether somebody wrote in between (see `deriveBaseVersion` in `syncPure.ts`).
   */
  private async performSync(signal: AbortSignal): Promise<SyncCycleOutcome> {
    if (!this.storyId) {
      console.log('No storyId set for sync operation.');
      return 'ok';
    }

    if (!this.client.defaults.baseURL) {
      console.log('No server URL set for sync operation.');
      this.deactivateStoryFromActiveCycle(this.storyId);
      return 'ok';
    }

    if (!this._db) {
      console.log('Drizzle client (db) is not initialized. Cannot perform sync.');
      this.deactivateStoryFromActiveCycle(this.storyId);
      return 'ok';
    }

    const binding = {
      storyId: this.storyId,
      db: this._db,
      client: this.client,
      activeServer: this.activeServer,
      signal,
    };
    this.cycleBinding = binding;
    const { storyId, db } = binding;

    try {
      this.throwIfCycleAborted(signal);
      // 1. Get local story details and initial server max operation version
      const localStory = await db.query.stories.findFirst({
        where: eq(schema.stories.id, storyId),
        columns: {
          id: true,
          version: true,
          lastServerSyncedLog: true,
          lastPublicFavoriteLog: true,
          myRole: true,
          favoriteBehavior: true,
        },
      });

      if (!localStory) {
        console.log(`Story with ID ${storyId} not found locally.`);
        this.deactivateStoryFromActiveCycle(storyId);
        return 'ok';
      }

      const lastSyncedLog = localStory.lastServerSyncedLog || 0;
      const lastPublicFavoriteLog = localStory.lastPublicFavoriteLog || 0;

      /**
       * We move the marker only up to the highest operation that actually arrived, and not up to the
       * response's `serverMaxOperationVersion`. The two are read in separate queries on the server: an
       * operation written between them makes it into the maximum but not into the list, and trusting the
       * maximum would skip it forever.
       */
      let highestAppliedRemoteVersion = lastSyncedLog;
      let highestAppliedPublicFavoriteVersion = lastPublicFavoriteLog;
      let myRole: SyncPullRole | undefined;
      // A broken pull must not veto the push: the failure is contained and reported, then the push runs.
      let pullFailed = false;
      const markRemoteOperationApplied = (update: StoryUpdate) => {
        highestAppliedRemoteVersion = Math.max(
          highestAppliedRemoteVersion,
          update.operationVersion || 0,
        );
        if (update.entity === 'Favorite') {
          highestAppliedPublicFavoriteVersion = Math.max(
            highestAppliedPublicFavoriteVersion,
            update.operationVersion || 0,
          );
        }
      };
      // The cursors persist even when the pull or the push failed: what the pull applied is
      // durable regardless of the push outcome.
      const persistPullProgress = async (): Promise<void> => {
        const roleChanged = myRole && myRole !== localStory.myRole;
        await db
          .update(schema.stories)
          .set({
            lastServerSyncedLog: highestAppliedRemoteVersion,
            lastPublicFavoriteLog: highestAppliedPublicFavoriteVersion,
            ...(myRole ? { myRole } : {}),
          })
          .where(eq(schema.stories.id, storyId));
        if (roleChanged) {
          this.dependencies.events.emit('story_role_changed', storyId);
        }
      };

      // 2. Pull remote updates first (since the latest known server version).
      try {
        const {
          updates: remoteUpdates,
          publicFavorites,
          role,
        } = await this.pull.fetchRemoteUpdates({
          lastSyncedLog,
          lastPublicFavoriteLog,
          favoriteBehavior: localStory.favoriteBehavior,
          fallbackRole: localStory.myRole || 'reader',
        });
        myRole = role;

        if (remoteUpdates && remoteUpdates.length > 0) {
          const batchOutcome = await this.pullApply.applyBatch({
            db,
            storyId,
            remoteUpdates,
            markApplied: markRemoteOperationApplied,
          });
          // A batch that stopped on a poisoned operation or an unknown entity is not a
          // success: reporting 'ok' would let a permanently stuck pull look healthy.
          if (batchOutcome.blocked) pullFailed = true;
        } else {
          console.log(`No new remote updates for story ${storyId} since version ${lastSyncedLog}`);
        }

        // The public snapshot is the authoritative source for collaborators' favourites. It closes gaps left by
        // stories imported without old logs and by cursors of clients that had already moved on before public
        // visibility was enabled. The server excludes the current user's rows so as not to overwrite a local
        // change of theirs that is still to be sent in the next step of this same cycle.
        if (publicFavorites.length > 0) {
          const favoriteHandler = this.entityHandlers.get('Favorite');
          if (!favoriteHandler) {
            throw new Error('Favorite sync handler is not registered.');
          }

          for (const favorite of publicFavorites) {
            const localFavorite = (await favoriteHandler.getById(favorite.id)) as
              | Favorite
              | undefined;
            const changed =
              !localFavorite ||
              localFavorite.version !== favorite.version ||
              localFavorite.isDeleted !== favorite.isDeleted ||
              localFavorite.entityId !== favorite.entityId ||
              localFavorite.entityType !== favorite.entityType ||
              localFavorite.userId !== favorite.userId;
            if (!changed) continue;

            await this.pull.applyRemoteCreate(
              protectRemoteUpdate({
                type: 'create',
                entity: 'Favorite',
                id: favorite.id,
                data: favorite,
                version: favorite.version,
              } as CreateStoryUpdate) as CreateStoryUpdate,
              favoriteHandler,
            );

            this.dependencies.events.emit(
              'favorite_changed',
              storyId,
              favorite.entityType,
              favorite.entityId,
              favorite.userId,
            );
            const targetEvent = FAVORITE_TARGET_EVENTS[favorite.entityType];
            if (targetEvent) this.dependencies.events.emit(targetEvent, storyId, favorite.entityId);
          }
        }
      } catch (pullError: any) {
        if (isAbortError(pullError)) throw pullError;
        if (isOfflineError(pullError)) {
          // Offline-first: an unreachable server is expected, not a failure worth
          // interrupting the user for. Retried on a shorter delay, without pushing.
          console.log(`Sync skipped for story ${storyId}: server unreachable.`);
          return 'offline';
        }
        if (isNotFoundError(pullError)) {
          // The story is gone server-side: pushing cannot succeed either, and retrying
          // next cycle changes nothing. Tell the user once and deactivate instead of
          // hammering a settled fact forever.
          console.log(`Sync stopped for story ${storyId}: not found on the server.`);
          this.dependencies.notifier.storyNotFound();
          this.deactivateStoryFromActiveCycle(storyId);
          return 'failed';
        }
        if (isProtocolMismatchError(pullError)) {
          console.log(`Sync refused for story ${storyId}: the server needs a newer sync protocol.`);
          this.dependencies.notifier.protocolMismatch();
        } else {
          console.log('Error during sync pull phase:', pullError?.message || pullError);
          this.dependencies.notifier.syncFailed();
        }
        pullFailed = true;
      }

      // 3-4. Push pending local operations in batches the server will accept.
      this.throwIfCycleAborted(signal);
      let pushFailed = false;
      try {
        await this.push.pushPendingOperations();
      } catch (pushError: any) {
        if (isAbortError(pushError)) throw pushError;
        if (isOfflineError(pushError)) {
          // The pull already applied above; its progress must not be lost to the re-fetch.
          await persistPullProgress();
          console.log(`Push skipped for story ${storyId}: server unreachable.`);
          return 'offline';
        }
        if (isNotFoundError(pushError)) {
          // Deleted between the pull and the push: keep what the pull applied, then stop
          // hammering the gone story like the pull phase does.
          await persistPullProgress();
          console.log(`Sync stopped for story ${storyId}: not found on the server.`);
          this.dependencies.notifier.storyNotFound();
          this.deactivateStoryFromActiveCycle(storyId);
          return 'failed';
        }
        pushFailed = true;
        if (isProtocolMismatchError(pushError)) {
          console.log(`Push refused for story ${storyId}: the server needs a newer sync protocol.`);
          this.dependencies.notifier.protocolMismatch();
        } else {
          console.log(
            `Error pushing local operations for story ${storyId}:`,
            pushError?.message || pushError,
          );
          this.dependencies.notifier.pushFailed();
        }
      }

      this.throwIfCycleAborted(signal);
      // 5. Update local story's lastServerSyncedLog and cached role.
      await persistPullProgress();

      // Reaching here means a server round-trip succeeded this cycle (offline paths return
      // earlier), so this is a real "last synced" timestamp - not just when the server was
      // registered (which is all `servers.lastSyncDate` ever reflected before).
      if (binding.activeServer) {
        const serverService = this.dependencies.createServerService(db);
        await serverService.updateServer(binding.activeServer.id, { lastSyncDate: new Date() });
      }

      this.throwIfCycleAborted(signal);
      // 6. Reconcile media files. It runs after the metadata on purpose: a media file can only be downloaded
      // after the row describing it has arrived, and can only be uploaded after the server has accepted that
      // same row.
      const mediaOffline = await this.media.sync();
      if (mediaOffline) return 'offline';
      return pullFailed || pushFailed ? 'failed' : 'ok';
    } catch (error: any) {
      if (isAbortError(error)) {
        console.log(`Sync cycle for story ${storyId} aborted.`);
        return 'ok';
      }
      if (isOfflineError(error)) {
        // Offline-first: an unreachable server is expected, not a failure worth
        // interrupting the user for. Retried on a shorter delay.
        console.log(`Sync skipped for story ${storyId}: server unreachable.`);
        return 'offline';
      }
      if (isProtocolMismatchError(error)) {
        console.log(`Sync refused for story ${storyId}: the server needs a newer sync protocol.`);
        this.dependencies.notifier.protocolMismatch();
        return 'failed';
      }
      console.log('Error during sync operation:', error?.message || error);
      this.dependencies.notifier.syncFailed();
      return 'failed';
    } finally {
      if (this.cycleBinding === binding) {
        this.cycleBinding = null;
      }
    }
  }
}
