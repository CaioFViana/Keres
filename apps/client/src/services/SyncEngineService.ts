import type {
  ChapterReorderingStoryUpdate,
  CreateStoryUpdate,
  EffectiveStoryRole,
  Favorite,
  StoryReorderingStoryUpdate,
  StoryUpdate,
} from '@keres/shared';
import { MAX_SYNC_PULL_BATCH } from '@keres/shared';
import { eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import type { ServerSelect } from '../db/schema';
import type { KeresAxiosInstance, TokenProvider } from './apiClient';
import { isOfflineError } from './apiClient';
import type { ClientSyncEntityHandler } from './entity-sync-handlers/ClientSyncEntityHandler';
import type { ServerService } from './ServerService';
import type { SyncConflictService } from './SyncConflictService';
import { applyReorderToLocalDb } from './SyncConflictService';
import {
  type ServerStoryPreview,
  type StoryUploadResult,
} from './sync/StoryTransfer';
import { SyncScheduler } from './sync/SyncScheduler';
import type { SyncContext } from './sync/SyncContext';
import { SyncPull } from './sync/SyncPull';
import { SyncPush } from './sync/SyncPush';
import { SyncMedia } from './sync/SyncMedia';
import type { SyncNotifier } from './sync/SyncNotifier';
import { protectRemoteUpdate, syncEntityKey } from './sync/syncPure';
import { FAVORITE_TARGET_EVENTS, SYNC_ENTITY_EVENTS } from './sync/syncEvents';

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

  public constructor(private readonly dependencies: SyncEngineDependencies) {
    this.client = dependencies.createClient();
    this.scheduler = new SyncScheduler({
      readiness: () => ({
        storyId: this.storyId,
        hasServer: Boolean(this.client.defaults.baseURL),
        hasDatabase: Boolean(this._db),
      }),
      performSync: () => this.performSync(),
    });
    this.entityHandlers = dependencies.createEntityHandlers();
    const syncContext: SyncContext = {
      db: () => {
        if (!this._db) throw new Error('Sync database is not configured.');
        return this._db;
      },
      storyId: () => {
        if (!this.storyId) throw new Error('Sync story is not configured.');
        return this.storyId;
      },
      client: () => this.client,
      conflictService: () => this.conflictService,
    };
    this.push = new SyncPush(syncContext);
    this.pull = new SyncPull({
      context: syncContext,
      rebasePendingOperations: (operations, version) =>
        this.push.rebasePendingOperations(operations, version),
    });
    this.media = new SyncMedia({
      db: () => this._db,
      storyId: () => this.storyId,
      server: () => this.activeServer,
      client: () => this.client,
    });
  }

  public get lifecycle(): SyncEngineLifecycle {
    if (!this._db) return 'unbound';
    if (!this.storyId || !this.activeServer) return 'idle';
    return this.scheduler.isRunning ? 'running' : 'active';
  }

  public bindDatabase(dbInstance: AppDrizzleClient): void {
    this._db = dbInstance;
    this._conflictService = null; // Recreated on demand, already bound to the new database.
    // Propagate the db instance to all registered handlers
    this.entityHandlers.forEach((handler) => handler.setDb(dbInstance));

    // Authentication resolves the server through the database bound to this engine instance.
    const serverService = this.dependencies.createServerService(dbInstance);
    this.dependencies.tokenProvider.setGetServerById(serverService.getServerById);
  }

  public activateStory(storyId: string, server: ServerSelect): void {
    if (!this._db) throw new Error('SyncEngineService: bind the database before activating a story.');
    if (!storyId) throw new Error('SyncEngineService: a story is required for activation.');
    if (!server.url) throw new Error('SyncEngineService: a server URL is required for activation.');

    this.stopSync();
    this.storyId = storyId;
    this.activeServer = server;
    this.client = this.dependencies.createClient(server.url);
    this.client.setTokenProvider(this.dependencies.tokenProvider);
    this.client.setActiveServer(server);
    console.log(`SyncEngineService activated for story ${storyId} with server: ${server.url}`);
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

  public deactivateStory(): void {
    this.stopSync();
    this.storyId = null;
    this.activeServer = null;
    this.client.defaults.baseURL = undefined;
  }

  public async reset(): Promise<void> {
    await this.scheduler.reset();
    this.storyId = null;
    this.activeServer = null;
    this.client.defaults.baseURL = undefined;
    this._db = null;
    this._conflictService = null;
    this.media.reset();
    console.log('Sync engine has been reset, database instance cleared.');
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
   * The version the user based their edit on.
   *
   * Every local service increments `version` by exactly 1 and writes the *resulting* version into the
   * operation's payload. The server needs the base, not the result: it is by comparing the base with the
   * version it holds now that it discovers whether somebody wrote in between. Sending the result (as used
   * to happen) made the check always pass.
   */
  /** Runs one full pull/push cycle. Resolves to true when the server was unreachable. */
  private async performSync(): Promise<boolean> {
    if (!this.storyId) {
      console.log('No storyId set for sync operation.');
      return false;
    }

    if (!this.client.defaults.baseURL) {
      console.log('No server URL set for sync operation.');
      this.deactivateStory();
      return false;
    }

    if (!this._db) {
      console.log('Drizzle client (db) is not initialized. Cannot perform sync.');
      this.deactivateStory();
      return false;
    }

    try {
      // 1. Get local story details and initial server max operation version
      const localStory = await this._db.query.stories.findFirst({
        where: eq(schema.stories.id, this.storyId),
        columns: {
          id: true,
          version: true,
          lastServerSyncedLog: true,
          lastPublicFavoriteLog: true,
          myRole: true,
        },
      });

      if (!localStory) {
        console.log(`Story with ID ${this.storyId} not found locally.`);
        this.deactivateStory();
        return false;
      }

      const lastSyncedLog = localStory.lastServerSyncedLog || 0;
      const lastPublicFavoriteLog = localStory.lastPublicFavoriteLog || 0;

      // 2. Pull remote updates first (since the latest known server version).
      // The server returns at most MAX_SYNC_PULL_BATCH ops; we repeat until a page comes back incomplete, so
      // as not to leave a large backlog for the next cycle.
      console.log(
        `Pulling remote updates for story ${this.storyId} since version ${lastSyncedLog}...`,
      );
      const remoteUpdates: StoryUpdate[] = [];
      let publicFavorites: Favorite[] = [];
      let myRole: 'owner' | 'writer' | 'reader' = localStory.myRole || 'reader';
      let pullCursor = lastSyncedLog;
      for (let page = 0; page < 20; page += 1) {
        const pullResponse = await this.client.get<{
          updates: StoryUpdate[];
          publicFavorites?: Favorite[];
          serverMaxOperationVersion: number;
          role: 'owner' | 'writer' | 'reader';
        }>(
          `/sync/${this.storyId}/pull?lastOperationVersion=${pullCursor}&lastPublicFavoriteVersion=${lastPublicFavoriteLog}`,
        );
        const pageUpdates = pullResponse.data.updates ?? [];
        publicFavorites = pullResponse.data.publicFavorites ?? publicFavorites;
        if (pullResponse.data.role) myRole = pullResponse.data.role;
        remoteUpdates.push(...pageUpdates);
        if (pageUpdates.length === 0) break;
        pullCursor = Math.max(
          pullCursor,
          ...pageUpdates.map((update) => update.operationVersion || 0),
        );
        if (pageUpdates.length < MAX_SYNC_PULL_BATCH) break;
      }

      /**
       * We move the marker only up to the highest operation that actually arrived, and not up to the
       * response's `serverMaxOperationVersion`. The two are read in separate queries on the server: an
       * operation written between them makes it into the maximum but not into the list, and trusting the
       * maximum would skip it forever.
       */
      let highestAppliedRemoteVersion = lastSyncedLog;
      let highestAppliedPublicFavoriteVersion = lastPublicFavoriteLog;
      let publicFavoriteCursorBlocked = false;
      const markRemoteOperationApplied = (update: StoryUpdate) => {
        highestAppliedRemoteVersion = Math.max(
          highestAppliedRemoteVersion,
          update.operationVersion || 0,
        );
        if (update.entity === 'Favorite' && !publicFavoriteCursorBlocked) {
          highestAppliedPublicFavoriteVersion = Math.max(
            highestAppliedPublicFavoriteVersion,
            update.operationVersion || 0,
          );
        }
      };

      if (remoteUpdates && remoteUpdates.length > 0) {
        let totalUpdates = remoteUpdates.length;
        let entitiesUpdated: string[] = [];
        let failedEntities: string[] = [];
        const changedEntityIds = new Map<string, Set<string>>();

        const markEntityUpdated = (entity: string, entityId?: string) => {
          if (!entitiesUpdated.includes(entity)) {
            entitiesUpdated.push(entity);
          }
          if (entityId) {
            const ids = changedEntityIds.get(entity) ?? new Set<string>();
            ids.add(entityId);
            changedEntityIds.set(entity, ids);
          }
        };

        console.log(`Received ${totalUpdates} remote updates. Applying to local DB...`);

        // Local operations not yet accepted by the server, indexed by entity. They are what remote updates can
        // collide with: applying the remote version on top would silently erase what the user wrote offline.
        const pendingByEntity = await this.push.getPendingOperationsByEntity();
        let conflictsDetected = 0;
        let pullBlocked = false;

        for (const rawUpdate of remoteUpdates) {
          if (pullBlocked) break;

          const update = protectRemoteUpdate(rawUpdate);
          const handler = this.entityHandlers.get(update.entity);
          if (!handler) {
            console.log(`No client sync handler registered for entity type: ${update.entity}`);
            pullBlocked = true;
            break;
          }

          if (update.entity === 'Story' && update.type === 'create' && update.id !== this.storyId) {
            console.warn(`Ignoring Story create for ${update.id} while syncing ${this.storyId}.`);
            await this.pull.recordRemoteOperationLocally(rawUpdate);
            markRemoteOperationApplied(rawUpdate);
            continue;
          }

          // An operation this very client sent and the server is handing back. It is already applied here;
          // reapplying it would only duplicate the row in the local log.
          if (await this.pull.isOwnEchoedOperation(rawUpdate)) {
            markRemoteOperationApplied(rawUpdate);
            continue;
          }

          const pendingLocalOps =
            pendingByEntity.get(syncEntityKey(update.entity, update.id || '')) || [];

          try {
            if (pendingLocalOps.length > 0) {
              const outcome = await this.pull.reconcileRemoteUpdate(
                update,
                pendingLocalOps,
                handler,
              );
              if (outcome.conflicted) {
                conflictsDetected += 1;
              }
              markEntityUpdated(update.entity, update.id);
              await this.pull.recordRemoteOperationLocally(rawUpdate);
              markRemoteOperationApplied(rawUpdate);
              continue;
            }

            if (update.type === 'create') {
              await this.pull.applyRemoteCreate(update, handler);
            } else if (update.type === 'update') {
              await handler.applyUpdate(this.storyId, update);
            } else if (update.type === 'delete') {
              await handler.applyDelete(this.storyId, update);
            } else if (update.type === 'reorder') {
              const reorderUpdate = update as
                | ChapterReorderingStoryUpdate
                | StoryReorderingStoryUpdate;

              if (!reorderUpdate.reorderItems || reorderUpdate.reorderItems.length === 0) {
                console.warn(
                  `Reorder update for entity ${update.entity} ID ${update.id} has no reorderItems.`,
                );
                pullBlocked = true;
                break;
              }

              await applyReorderToLocalDb(this._db, reorderUpdate, new Date(update.operationTime!));
            }
            markEntityUpdated(update.entity, update.id);

            await this.pull.recordRemoteOperationLocally(rawUpdate);
            markRemoteOperationApplied(rawUpdate);
          } catch (handlerError) {
            pullBlocked = true;
            if (
              update.entity === 'Favorite' &&
              (update.operationVersion || 0) > lastPublicFavoriteLog
            ) {
              publicFavoriteCursorBlocked = true;
            }
            console.log(
              `Error applying ${update.type} for entity ${update.entity} ID ${update.id}:`,
              handlerError,
            );
            if (!failedEntities.includes(update.entity)) {
              failedEntities.push(update.entity);
            }
          }
        }

        // One consolidated notification per sync cycle instead of one per failed
        // item - a single flaky entity type shouldn't flood the user with a
        // notification for every record it touches.
        if (entitiesUpdated.length > 0) {
          this.dependencies.notifier.remoteUpdatesReceived(totalUpdates, entitiesUpdated);
        }
        if (failedEntities.length > 0) {
          this.dependencies.notifier.remoteUpdatesFailed(failedEntities);
        }
        if (conflictsDetected > 0) {
          this.dependencies.notifier.conflictsDetected(conflictsDetected);
        }
        // Emit events after the whole pull so a batch causes one refresh per
        // affected entity type instead of one query per operation.
        for (const [entity, ids] of changedEntityIds) {
          const eventName = SYNC_ENTITY_EVENTS[entity];
          if (!eventName) continue;
          for (const entityId of ids) {
            if (entity === 'Favorite') {
              const favorite = await this._db.query.favorites.findFirst({
                where: eq(schema.favorites.id, entityId),
                columns: { entityId: true, entityType: true, userId: true },
              });
              if (favorite) {
                this.dependencies.events.emit(
                  'favorite_changed',
                  this.storyId,
                  favorite.entityType,
                  favorite.entityId,
                  favorite.userId,
                );
              }
              const targetEvent = favorite && FAVORITE_TARGET_EVENTS[favorite.entityType];
              if (targetEvent)
                this.dependencies.events.emit(targetEvent, this.storyId, favorite.entityId);
            } else {
              this.dependencies.events.emit(eventName, this.storyId, entityId);
            }
          }
        }
        this.dependencies.events.emit('story_data_changed', {
          storyId: this.storyId,
          entityTypes: Array.from(changedEntityIds.keys()),
          entityIds: Object.fromEntries(
            Array.from(changedEntityIds.entries()).map(([entity, ids]) => [
              entity,
              Array.from(ids),
            ]),
          ),
          source: 'sync',
        });

        // Emit event to signal operation log update after applying remote updates
        this.dependencies.events.emit('operation_log_updated', this.storyId);
      } else {
        console.log(
          `No new remote updates for story ${this.storyId} since version ${lastSyncedLog}`,
        );
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
            this.storyId,
            favorite.entityType,
            favorite.entityId,
            favorite.userId,
          );
          const targetEvent = FAVORITE_TARGET_EVENTS[favorite.entityType];
          if (targetEvent)
            this.dependencies.events.emit(targetEvent, this.storyId, favorite.entityId);
        }
      }

      // 3-4. Push pending local operations in batches the server will accept.
      try {
        const pushed = await this.push.pushPendingOperations();
        if (pushed.offline) {
          return true;
        }
      } catch (pushError: any) {
        if (isOfflineError(pushError)) {
          console.log(`Push skipped for story ${this.storyId}: server unreachable.`);
          return true;
        }
        console.log(
          `Error pushing local operations for story ${this.storyId}:`,
          pushError?.message || pushError,
        );
        this.dependencies.notifier.pushFailed();
      }

      // 5. Update local story's lastServerSyncedLog and cached role
      const roleChanged = myRole && myRole !== localStory.myRole;
      await this._db
        .update(schema.stories)
        .set({
          lastServerSyncedLog: highestAppliedRemoteVersion,
          lastPublicFavoriteLog: highestAppliedPublicFavoriteVersion,
          myRole,
        })
        .where(eq(schema.stories.id, this.storyId));
      if (roleChanged) {
        this.dependencies.events.emit('story_role_changed', this.storyId);
      }

      // Reaching here means the pull round-trip against the server succeeded, so this is
      // a real "last synced" timestamp - not just when the server was registered (which is
      // all `servers.lastSyncDate` ever reflected before, since nothing else touched it).
      if (this.activeServer) {
        const serverService = this.dependencies.createServerService(this._db);
        await serverService.updateServer(this.activeServer.id, { lastSyncDate: new Date() });
      }

      // 6. Reconcile media files. It runs after the metadata on purpose: a media file can only be downloaded
      // after the row describing it has arrived, and can only be uploaded after the server has accepted that
      // same row.
      return await this.media.sync();
    } catch (error: any) {
      if (isOfflineError(error)) {
        // Offline-first: an unreachable server is expected, not a failure worth
        // interrupting the user for. Retried on a shorter delay.
        console.log(`Sync skipped for story ${this.storyId}: server unreachable.`);
        return true;
      }
      console.log('Error during sync operation:', error?.message || error);
      this.dependencies.notifier.syncFailed();
      return false;
    }
  }
}
