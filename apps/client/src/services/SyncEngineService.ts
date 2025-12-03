import { StoryUpdate } from '@keres/shared';
import { AxiosInstance } from 'axios';
import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import { useNotificationStore } from '../state/notificationStore'; // Added
import { createServerService } from './ServerService'; // Import createServerService
import { createStoryService } from './StoryService';
import { createKeresAxiosInstance } from './apiClient';
import { ClientSyncEntityHandler } from './entity-sync-handlers/ClientSyncEntityHandler';
import { StoryClientSyncHandler } from './entity-sync-handlers/StoryClientSyncHandler';

interface SyncPreview {
  storyId: string;
  serverVersion: number;
  lastUpdatedAt: string;
  entityUpdates: StoryUpdate[];
}

interface ServerStoryPreview {
  storyId: string;
  lastOperationVersion: number;
}

class SyncEngineService {
  private static instance: SyncEngineService;
  private syncInterval: number | null = null;
  private storyId: string | null = null;
  private client: AxiosInstance;
  private intervalTimeMs: number = 30000;
  private _db: AppDrizzleClient | null = null;
  private entityHandlers: Map<string, ClientSyncEntityHandler>; // Map to hold entity handlers

  private constructor() {
    this.client = createKeresAxiosInstance();
    this.entityHandlers = new Map<string, ClientSyncEntityHandler>();
    // Register handlers
    this.registerEntityHandler(new StoryClientSyncHandler());
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
  }

  public async configure(storyId: string | undefined, serverUrl: string | null) {
    this.storyId = storyId || null;
    if (serverUrl) {
      this.client = createKeresAxiosInstance({ baseURL: serverUrl });
      // The JWT handling is now centralized in the apiClient interceptor, so no need to add headers here.
      console.log(`SyncEngineService configured for story ${this.storyId} with server: ${serverUrl}`);
    } else {
      console.log('SyncEngineService configured without a server URL. Sync will be disabled.');
      this.stopSync();
    }
  }

  public startSync(intervalTimeMs?: number) {
    if (this.syncInterval) {
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

    this.performSync();

    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.intervalTimeMs);
  }

  public stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Sync engine stopped.');
    }
    this.storyId = null;
    this.client.defaults.baseURL = undefined;
  }

  public async fetchServerStoryPreviews(serverUrl: string): Promise<ServerStoryPreview[]> {
    if (!serverUrl) {
      console.log('Server URL is required to fetch story previews.');
      return [];
    }

    // Use a new instance from the factory, configured with the specific serverUrl
    // JWT handling is done by the interceptor if a tokenProvider is set
    const tempClient = createKeresAxiosInstance({
      baseURL: serverUrl,
    });

    try {
      const response = await tempClient.get<{ message: string; storyPreviews: ServerStoryPreview[] }>('/sync/pullpreviews');
      return response.data.storyPreviews;
    } catch (error) {
      console.log(`Error fetching server story previews from ${serverUrl}:`, error);
      return [];
    }
  }

  public async downloadAndImportStory(queriedServerId: string, storyId: string, userId: string): Promise<void> {
    const { showNotification } = useNotificationStore.getState();
    if (!this._db) {
      showNotification(`Failed to download story '${storyId}': Database not set.`, 'error');
      //console.log('Drizzle client (db) is not set. Cannot download and import story.');
      return;
    }
    if (!queriedServerId) {
      showNotification(`Failed to download story '${storyId}': Server ID not set.`, 'error');
      return;
    }
    if (!userId) {
      showNotification(`Failed to download story '${storyId}': User ID not set.`, 'error');
      //console.log('User ID is required to import story.');
      return;
    }

    let serverUrl: string | null = null;
    try {
      const serverService = createServerService(this._db);
      const server = await serverService.getServerById(queriedServerId);
      if (server?.url) {
        serverUrl = server.url;
      }
      else {
        showNotification(`Failed to download story '${storyId}': Server URL not found for ID ${queriedServerId}.`, 'error');
        return;
      }
    } catch (error) {
      console.error('Error fetching server details by ID:', error);
      showNotification(`Failed to download story '${storyId}': Error retrieving server details.`, 'error');
      return;
    }

    // Use a new instance from the factory, configured with the specific serverUrl
    // JWT handling is done by the interceptor if a tokenProvider is set
    const tempClient = createKeresAxiosInstance({
      baseURL: serverUrl,
    });

    try {
      const exportUrl = `/stories/${storyId}/export`;
      console.log(`Attempting to download story ${storyId} from ${serverUrl}${exportUrl}`);
      const response = await tempClient.get(exportUrl);
      const fullStoryData = response.data; // This should be of type FullStoryExport

      // Create a story service instance using the injected db
      const storyService = createStoryService(this._db);
      await storyService.importFullStory(userId, fullStoryData, queriedServerId);
      console.log(`Successfully downloaded and imported story ${storyId}`);
      showNotification(`Story '${storyId}' downloaded and imported!`, 'success');

    } catch (error) {
      console.log(`Error downloading or importing story ${storyId} from ${serverUrl}:`, error);
      showNotification(`Failed to download story '${storyId}'.`, 'error');
    }
  }


  private async performSync() {
    const { showNotification } = useNotificationStore.getState();
    if (!this.storyId) {
      console.log('No storyId set for sync operation.');
      return;
    }

    if (!this.client.defaults.baseURL) {
      console.log('No server URL set for sync operation.');
      this.stopSync();
      return;
    }

    if (!this._db) {
      console.log('Drizzle client (db) is not initialized. Cannot perform sync.');
      this.stopSync();
      return;
    }

    try {
      // 1. Get local story version
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
        return;
      }

      const sinceVersion = localStory.lastServerSyncedLog || 0;

      // 2. Call API for pull previews
      const response = await this.client.get<SyncPreview[]>(`/sync/${this.storyId}/pull?lastOperationVersion=${sinceVersion}`);
      const previews = response.data;

      if (previews && previews.length > 0) {
        let totalUpdates = 0;
        let lastOriginatingUser: string | null = null; // Will need to be extracted from actual update
        let entitiesUpdated: string[] = [];

        for (const preview of previews) {
          totalUpdates += preview.entityUpdates.length;
          // For now, previews don't contain originating user info directly,
          // so this part of notification will be generic until actual operations are pulled.

          // Apply entity updates locally using handlers
          for (const update of preview.entityUpdates) {
            const handler = this.entityHandlers.get(update.entity); // Use update.entity for entityType
            if (!handler) {
              console.log(`No client sync handler registered for entity type: ${update.entity}`);
              continue;
            }

            try {
              // The update object from API is a simplified version (preview)
              // For actual application, we'd need full StoryUpdate objects from the server
              // This is a placeholder for how full updates would be applied.
              if (update.type === 'create') {
                await handler.applyCreate(update);
              } else if (update.type === 'update') {
                await handler.applyUpdate(update);
              } else if (update.type === 'delete') {
                await handler.applyDelete(update);
              }
              if (!entitiesUpdated.includes(update.entity)) {
                entitiesUpdated.push(update.entity);
              }
            } catch (handlerError) {
              console.log(`Error applying ${update.type} for entity ${update.entity} ID ${update.id}:`, handlerError);
            }
          }
        }

        const message = `${totalUpdates} updates available. Updated: ${entitiesUpdated.join(', ')}.`;
        
        showNotification(message, 'info');

        // Update lastServerSyncedLog with the latest server version received
        const latestServerVersion = parseInt(previews[previews.length - 1].serverVersion.toString(), 10);
        await this._db.update(schema.stories)
          .set({ lastServerSyncedLog: latestServerVersion })
          .where(eq(schema.stories.id, this.storyId));

      } else {
        console.log(`No new sync previews for story ${this.storyId} since version ${sinceVersion}`);
      }

    } catch (error) {
      console.log('Error during sync operation:', error);
      // Implement more robust error handling (e.g., exponential backoff)
    }
  }
}

export const syncEngineService = SyncEngineService.getInstance();