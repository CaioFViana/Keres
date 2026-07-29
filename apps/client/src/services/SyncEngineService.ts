import { ChapterReorderingStoryUpdate, CreateStoryUpdate, DeleteStoryUpdate, StoryReorderingStoryUpdate, StoryUpdate, UpdateStoryUpdate } from '@keres/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import { ServerSelect } from '../db/schema';
import { useNotificationStore } from '../state/notificationStore';
import { entityEventEmitter } from '../utils/EventEmitter';
import { createKeresAxiosInstance, isOfflineError, KeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';
import { ChapterClientSyncHandler } from './entity-sync-handlers/ChapterClientSyncHandler';
import { CharacterClientSyncHandler } from './entity-sync-handlers/CharacterClientSyncHandler';
import { CharacterRelationClientSyncHandler } from './entity-sync-handlers/CharacterRelationClientSyncHandler';
import { CharacterSceneClientSyncHandler } from './entity-sync-handlers/CharacterSceneClientSyncHandler';
import { ChoiceClientSyncHandler } from './entity-sync-handlers/ChoiceClientSyncHandler';
import { ClientSyncEntityHandler } from './entity-sync-handlers/ClientSyncEntityHandler';
import { ItemClientSyncHandler } from './entity-sync-handlers/ItemClientSyncHandler';
import { ItemJourneyClientSyncHandler } from './entity-sync-handlers/ItemJourneyClientSyncHandler';
import { LocationClientSyncHandler } from './entity-sync-handlers/LocationClientSyncHandler';
import { NoteClientSyncHandler } from './entity-sync-handlers/NoteClientSyncHandler';
import { NoteRelationClientSyncHandler } from './entity-sync-handlers/NoteRelationClientSyncHandler';
import { SceneClientSyncHandler } from './entity-sync-handlers/SceneClientSyncHandler';
import { StoryClientSyncHandler } from './entity-sync-handlers/StoryClientSyncHandler';
import { TagClientSyncHandler } from './entity-sync-handlers/TagClientSyncHandler';
import { WorldRuleClientSyncHandler } from './entity-sync-handlers/WorldRuleClientSyncHandler';
import { createServerService } from './ServerService';
import { createStoryService } from './storymanagement/StoryService';

export interface ServerStoryPreview {
  storyId: string;
  lastOperationVersion: number;
}

/** Normal cadence while the server is responding. */
export const SYNC_INTERVAL_MS = 30000;
/**
 * Cadence while the server is unreachable. Much shorter than the normal interval so
 * that coming back online is noticed (and announced) within seconds instead of leaving
 * the user staring at an "offline" banner long after the server is back.
 */
export const OFFLINE_RETRY_MS = 5000;

export class SyncEngineService {
  private static instance: SyncEngineService;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private isRunning: boolean = false;
  /**
   * Incremented by every start/stop. A cycle captures the value it started under and
   * refuses to schedule its successor once it changes, so a cycle still in flight when
   * sync is restarted can't leave a second timer chain running alongside the new one.
   */
  private syncGeneration: number = 0;
  private storyId: string | null = null;
  private client: KeresAxiosInstance;
  private intervalTimeMs: number = SYNC_INTERVAL_MS;
  private _db: AppDrizzleClient | null = null;
  private entityHandlers: Map<string, ClientSyncEntityHandler>; // Map to hold entity handlers

  private constructor() {
    this.client = createKeresAxiosInstance();
    this.entityHandlers = new Map<string, ClientSyncEntityHandler>();
    // Register handlers
    this.registerEntityHandler(new StoryClientSyncHandler());
    this.registerEntityHandler(new CharacterClientSyncHandler());
    this.registerEntityHandler(new TagClientSyncHandler());
    this.registerEntityHandler(new NoteClientSyncHandler());
    this.registerEntityHandler(new NoteRelationClientSyncHandler())
    this.registerEntityHandler(new WorldRuleClientSyncHandler());
    this.registerEntityHandler(new CharacterRelationClientSyncHandler());
    this.registerEntityHandler(new LocationClientSyncHandler());
    this.registerEntityHandler(new ChapterClientSyncHandler());
    this.registerEntityHandler(new CharacterSceneClientSyncHandler());
    this.registerEntityHandler(new ChoiceClientSyncHandler())
    this.registerEntityHandler(new ItemClientSyncHandler())
    this.registerEntityHandler(new ItemJourneyClientSyncHandler())
    this.registerEntityHandler(new SceneClientSyncHandler())
    // TODO: Register other entity handlers here
  }

  public static getInstance(): SyncEngineService {
    if (!SyncEngineService.instance) {
      SyncEngineService.instance = new SyncEngineService();
    }
    return SyncEngineService.instance;
  }


  private registerEntityHandler(handler: ClientSyncEntityHandler) {
    this.entityHandlers.set(handler.entityName, handler);
  }

  public setDbInstance(dbInstance: AppDrizzleClient) {
    this._db = dbInstance;
    // Propagate the db instance to all registered handlers
    this.entityHandlers.forEach(handler => handler.setDb(dbInstance));

    // Inject getServerById into authTokenManager to break circular dependency
    const serverService = createServerService(dbInstance);
    authTokenManager.setGetServerById(serverService.getServerById);
  }

  public async configure(storyId: string | undefined, server: ServerSelect | null) {
    this.storyId = storyId || null;
    if (server?.url) {
      this.client = createKeresAxiosInstance({ baseURL: server.url });
      // Bind this client to the specific server so the request interceptor always attaches
      // *this* server's token, regardless of what any other concurrent sync/refresh is doing.
      this.client.setTokenProvider(authTokenManager);
      this.client.setActiveServer(server);
      console.log(`SyncEngineService configured for story ${this.storyId} with server: ${server.url}`);
    } else {
      console.log('SyncEngineService configured without a server URL. Sync will be disabled.');
      this.stopSync();
    }
  }

  public startSync(intervalTimeMs?: number) {
    if (this.isRunning) {
      console.log('Sync engine already running.');
      return;
    }

    if (!this.storyId) {
      console.log('Cannot start sync: storyId is not set. Call configure() first.');
      return;
    }

    if (!this.client.defaults.baseURL) {
      console.log('Cannot start sync: server URL is not set. Call configure() with a valid serverUrl.');
      return;
    }

    if (!this._db) {
      console.log('Cannot start sync: Drizzle client (db) is not set. Call setDbInstance() first.');
      return;
    }

    this.intervalTimeMs = intervalTimeMs || this.intervalTimeMs;
    console.log(`Starting sync for story ${this.storyId} with interval ${this.intervalTimeMs / 1000}s`);

    this.isRunning = true;
    this.syncGeneration += 1;
    const generation = this.syncGeneration;

    // Self-scheduling rather than setInterval: each cycle picks its own next delay, so
    // an unreachable server is retried quickly while a healthy one keeps the slow
    // cadence. It also guarantees cycles never overlap, which setInterval does not.
    const runCycle = async () => {
      let wasOffline = false;
      try {
        wasOffline = await this.performSync();
      } catch (error) {
        if (isOfflineError(error)) {
          console.log('SyncEngineService: sync cycle skipped, server unreachable.');
          wasOffline = true;
        } else {
          console.error('SyncEngineService: Unexpected error during sync cycle.', error);
        }
      }

      // Bail out if sync was stopped, or restarted under a new generation, while this
      // cycle was in flight - otherwise we'd leave a stray timer chain behind.
      if (!this.isRunning || this.syncGeneration !== generation) {
        return;
      }
      this.syncTimer = setTimeout(runCycle, wasOffline ? OFFLINE_RETRY_MS : this.intervalTimeMs);
    };

    // First cycle runs immediately - no waiting for the interval to elapse.
    runCycle();
  }

  public stopSync() {
    this.isRunning = false;
    this.syncGeneration += 1; // Invalidate any cycle currently in flight
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
      console.log('Sync engine stopped.');
    }
    this.storyId = null;
    this.client.defaults.baseURL = undefined;
  }

  public reset() {
    this.stopSync();
    this._db = null;
    console.log('Sync engine has been reset, database instance cleared.');
  }

  public async fetchServerStoryPreviews(server: ServerSelect): Promise<ServerStoryPreview[]> {
    if (!server?.url) {
      console.log('A server with a URL is required to fetch story previews.');
      return [];
    }

    // Use a new instance from the factory, bound to this specific server so the
    // interceptor attaches this server's own token rather than whatever another
    // concurrent client last set.
    const tempClient = createKeresAxiosInstance({
      baseURL: server.url,
    });
    tempClient.setTokenProvider(authTokenManager);
    tempClient.setActiveServer(server);

    try {
      const response = await tempClient.get<{ message: string; storyPreviews: ServerStoryPreview[] }>('/sync/pullpreviews');
      return response.data.storyPreviews;
    } catch (error) {
      console.log(`Error fetching server story previews from ${server.url}:`, error);
      return [];
    }
  }

  public async downloadAndImportStory(queriedServerId: string, storyId: string, userId: string): Promise<void> {
    const { showNotification } = useNotificationStore.getState();
    if (!this._db) {
      showNotification(`Failed to download story '${storyId}': Database not set.`, 'error');
      return;
    }
    if (!queriedServerId) {
      showNotification(`Failed to download story '${storyId}': Server ID not set.`, 'error');
      return;
    }
    if (!userId) {
      showNotification(`Failed to download story '${storyId}': User ID not set.`, 'error');
      return;
    }

    let server: ServerSelect | undefined;
    try {
      const serverService = createServerService(this._db);
      server = await serverService.getServerById(queriedServerId);
      if (!server?.url) {
        showNotification(`Failed to download story '${storyId}': Server URL not found for ID ${queriedServerId}.`, 'error');
        return;
      }
    } catch (error) {
      console.error('Error fetching server details by ID:', error);
      showNotification(`Failed to download story '${storyId}': Error retrieving server details.`, 'error');
      return;
    }

    if (!server?.url) {
      return;
    }

    const tempClient = createKeresAxiosInstance({
      baseURL: server.url,
    });
    tempClient.setTokenProvider(authTokenManager);
    tempClient.setActiveServer(server);

    try {
      const exportUrl = `/stories/${storyId}/export`;
      console.log(`Attempting to download story ${storyId} from ${server.url}${exportUrl}`);
      const response = await tempClient.get(exportUrl);
      const fullStoryData = response.data;

      const storyService = createStoryService(this._db);
      await storyService.importFullStory(userId, fullStoryData, queriedServerId);
      console.log(`Successfully downloaded and imported story ${storyId}`);
      showNotification(`Story '${storyId}' downloaded and imported!`, 'success');

    } catch (error) {
      console.log(`Error downloading or importing story ${storyId} from ${server.url}:`, error);
      showNotification(`Failed to download story '${storyId}'.`, 'error');
    }
  }


  /** Runs one full pull/push cycle. Resolves to true when the server was unreachable. */
  private async performSync(): Promise<boolean> {
    const { showNotification } = useNotificationStore.getState();
    if (!this.storyId) {
      console.log('No storyId set for sync operation.');
      return false;
    }

    if (!this.client.defaults.baseURL) {
      console.log('No server URL set for sync operation.');
      this.stopSync();
      return false;
    }

    if (!this._db) {
      console.log('Drizzle client (db) is not initialized. Cannot perform sync.');
      this.stopSync();
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
        },
      });

      if (!localStory) {
        console.log(`Story with ID ${this.storyId} not found locally.`);
        this.stopSync();
        return false;
      }

      let currentServerMaxOperationVersion = localStory.lastServerSyncedLog || 0;

      // 2. Pull remote updates first (since the latest known server version)
      console.log(`Pulling remote updates for story ${this.storyId} since version ${currentServerMaxOperationVersion}...`);
      const pullResponse = await this.client.get<{ updates: StoryUpdate[]; serverMaxOperationVersion: number }>(`/sync/${this.storyId}/pull?lastOperationVersion=${currentServerMaxOperationVersion}`);
      const { updates: remoteUpdates, serverMaxOperationVersion: newServerMaxOperationVersion } = pullResponse.data;

      // Update currentServerMaxOperationVersion based on pull response
      currentServerMaxOperationVersion = newServerMaxOperationVersion;

      if (remoteUpdates && remoteUpdates.length > 0) {
        let totalUpdates = remoteUpdates.length;
        let entitiesUpdated: string[] = [];
        let failedEntities: string[] = [];

        console.log(`Received ${totalUpdates} remote updates. Applying to local DB...`);
        for (const update of remoteUpdates) {
          const handler = this.entityHandlers.get(update.entity);
          if (!handler) {
            console.log(`No client sync handler registered for entity type: ${update.entity}`);
            continue;
          }

          try {
            if (update.type === 'create') {
              await handler.applyCreate(this.storyId, update);
            } else if (update.type === 'update') {
              await handler.applyUpdate(this.storyId, update);
            } else if (update.type === 'delete') {
              await handler.applyDelete(this.storyId, update);
            } else if (update.type === 'reorder') {
              const reorderUpdate = update as ChapterReorderingStoryUpdate | StoryReorderingStoryUpdate;
              const reorderItems = reorderUpdate.reorderItems;

              if (!reorderItems || reorderItems.length === 0) {
                console.warn(`Reorder update for entity ${update.entity} ID ${update.id} has no reorderItems.`);
                continue;
              }

              // Apply reorder to local database within a transaction
              await this._db.transaction(async (tx) => {
                for (const item of reorderItems) {
                  if (reorderUpdate.entity === 'Chapter') { // Reordering scenes within a chapter
                    await tx.update(schema.scenes)
                      .set({
                        index: item.newIndex,
                        updatedAt: new Date(update.operationTime!),
                        version: sql`${schema.scenes.version} + 1`
                      })
                      .where(eq(schema.scenes.id, item.id));
                  } else if (reorderUpdate.entity === 'Story') { // Reordering chapters within a story
                    await tx.update(schema.chapters)
                      .set({
                        index: item.newIndex,
                        updatedAt: new Date(update.operationTime!),
                        version: sql`${schema.chapters.version} + 1`
                      })
                      .where(eq(schema.chapters.id, item.id));
                  }
                }
              });
            }
            if (!entitiesUpdated.includes(update.entity)) {
              entitiesUpdated.push(update.entity);
            }

            // Insert the pulled operation into the local operationLogs table
            const payloadToStore = update.type === 'create' ? update.data :
                                   update.type === 'update' ? update.changes :
                                   update.type === 'reorder' ? update.reorderItems : // Store reorderItems for reorder operations
                                   { id: update.id }; // For delete, just store the ID

            await this._db.insert(schema.operationLogs).values({
              id: update.id!,
              storyId: this.storyId,
              userId: update.originatingUser!, // Ensure originatingUser is present in StoryUpdate
              operationVersion: update.operationVersion!,
              operationType: update.type,
              entityType: update.entity,
              entityId: update.id!,
              payload: JSON.stringify(payloadToStore),
              createdAt: new Date(update.operationTime!),
              isSynced: true, // Mark as synced because it came from the server
              serverOperationVersion: update.operationVersion!,
            });

          } catch (handlerError) {
            console.log(`Error applying ${update.type} for entity ${update.entity} ID ${update.id}:`, handlerError);
            if (!failedEntities.includes(update.entity)) {
              failedEntities.push(update.entity);
            }
          }
        }

        // One consolidated notification per sync cycle instead of one per failed
        // item - a single flaky entity type shouldn't flood the user with a
        // notification for every record it touches.
        if (entitiesUpdated.length > 0) {
          showNotification(`${totalUpdates} new updates from server. Updated: ${entitiesUpdated.join(', ')}.`, 'info');
        }
        if (failedEntities.length > 0) {
          showNotification(`Failed to apply some remote updates: ${failedEntities.join(', ')}.`, 'error');
        }
        // Emit event to signal operation log update after applying remote updates
        entityEventEmitter.emit('operation_log_updated', this.storyId);
      } else {
        console.log(`No new remote updates for story ${this.storyId} since version ${currentServerMaxOperationVersion}`);
      }

      // 3. Fetch pending local operations (after applying remote updates to bring local DB up to date)
      const pendingLocalOperations = await this._db.query.operationLogs.findMany({
        where: and(
          eq(schema.operationLogs.storyId, this.storyId),
          eq(schema.operationLogs.isSynced, false)
        ),
        orderBy: ({ createdAt }) => [asc(createdAt)], // Order by creation time
      });

      // 4. Push local updates to server
      if (pendingLocalOperations.length > 0) {
        console.log(`Pushing ${pendingLocalOperations.length} local operations for story ${this.storyId} to server...`);
        try {
          const updatesToPush: StoryUpdate[] = pendingLocalOperations.map(op => {
            const baseUpdate: Omit<StoryUpdate, 'type'> = {
              entity: op.entityType,
              id: op.entityId,
              // The top-level 'version' field in StoryUpdate is the operation's version in the log.
              // It's not directly used for entity version conflict detection on the server side
              // for update/delete operations, but can be useful for logging or debugging.
              version: op.operationVersion,
              operationTime: op.createdAt.toISOString(),
            };

            const payloadData = JSON.parse(op.payload);
            // Remove client-generated timestamp fields that should be server-managed
            const filteredPayloadData: Record<string, any> = { ...payloadData };
            delete filteredPayloadData.createdAt;
            delete filteredPayloadData.updatedAt;
            delete filteredPayloadData.deletedAt;
            delete filteredPayloadData.storyId; // Remove storyId if it somehow got into payloadData

            // Adjust field names for CharacterRelation to match server schema
            if (op.entityType === 'CharacterRelation') {
              if (filteredPayloadData.charId1 !== undefined) {
                filteredPayloadData.character1Id = filteredPayloadData.charId1;
                delete filteredPayloadData.charId1;
              }
              if (filteredPayloadData.charId2 !== undefined) {
                filteredPayloadData.character2Id = filteredPayloadData.charId2;
                delete filteredPayloadData.charId2;
              }
            }

            // For update and delete, the server expects the client's current entity version
            // for optimistic concurrency checks. This is the 'version' that was present
            // in the entity when the client created the local operation.
            const entityVersionAtClientChange = payloadData.version; // This is the entity's version, not the operation log version

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
                    // Explicitly include the entity's version at the time of client's change.
                    // This is crucial for the server's checkVersionConflict method.
                    version: entityVersionAtClientChange,
                  },
                } as UpdateStoryUpdate;
              case 'delete':
                return {
                  ...baseUpdate,
                  type: 'delete',
                  // For delete, the server checks 'update.version', so we place the entity's
                  // client-known version here.
                  version: entityVersionAtClientChange,
                } as DeleteStoryUpdate;
              case 'reorder':
                if (op.entityType === 'Chapter' && Array.isArray(filteredPayloadData.reorderItems)) {
                    return {
                        ...baseUpdate,
                        type: 'reorder',
                        entity: 'Chapter',
                        reorderItems: filteredPayloadData.reorderItems.map((item: any) => ({ ...item })),
                    } as ChapterReorderingStoryUpdate;
                } else if (op.entityType === 'Story' && Array.isArray(filteredPayloadData.reorderItems)) {
                    return {
                        ...baseUpdate,
                        type: 'reorder',
                        entity: 'Story',
                        reorderItems: filteredPayloadData.reorderItems.map((item: any) => ({ ...item })),
                    } as StoryReorderingStoryUpdate;
                }
                console.warn(`Unhandled reorder operation type or entity: ${op.entityType}, ${op.operationType}`);
                return null;

              default:
                console.warn(`Unhandled operation type: ${op.operationType}`);
                return null;
            }
          }).filter(Boolean) as StoryUpdate[];
          console.log(updatesToPush) // Log the payload being sent
          const pushResponse = await this.client.post<{ message: string; serverMaxOperationVersion: number }>(`/sync/${this.storyId}`, updatesToPush);
          currentServerMaxOperationVersion = pushResponse.data.serverMaxOperationVersion;
          // Mark local operations as synced
          for (const op of pendingLocalOperations) {
            await this._db.update(schema.operationLogs)
              .set({ isSynced: true, serverOperationVersion: currentServerMaxOperationVersion })
              .where(eq(schema.operationLogs.id, op.id));
          }
          // Emit event to signal operation log update
          entityEventEmitter.emit('operation_log_updated', this.storyId);
          console.log(`Successfully pushed ${pendingLocalOperations.length} operations. New server max version: ${currentServerMaxOperationVersion}`);
          showNotification(`Pushed ${pendingLocalOperations.length} updates.`, 'success');

        } catch (pushError: any) {
          if (isOfflineError(pushError)) {
            // Server unreachable: the operations stay unsynced and will be retried
            // on the next cycle. Nothing for the user to act on.
            console.log(`Push skipped for story ${this.storyId}: server unreachable.`);
            return true;
          }
          console.log(`Error pushing local operations for story ${this.storyId}:`, pushError?.message || pushError);
          showNotification(`Failed to push updates: ${pushError.message || 'Unknown error'}`, 'error');
        }
      }

      // 5. Update local story's lastServerSyncedLog
      await this._db.update(schema.stories)
        .set({ lastServerSyncedLog: currentServerMaxOperationVersion })
        .where(eq(schema.stories.id, this.storyId));

      return false;
    } catch (error: any) {
      if (isOfflineError(error)) {
        // Offline-first: an unreachable server is expected, not a failure worth
        // interrupting the user for. Retried on a shorter delay.
        console.log(`Sync skipped for story ${this.storyId}: server unreachable.`);
        return true;
      }
      console.log('Error during sync operation:', error?.message || error);
      showNotification(`Sync failed: ${error.message || 'Unknown error'}`, 'error');
      return false;
    }
  }

}