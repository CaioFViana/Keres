import { StoryUpdate } from '@keres/shared';
import axios, { AxiosInstance } from 'axios';
import { eq } from 'drizzle-orm';
import { ToastAndroid } from 'react-native';
import { AppDrizzleClient } from '../db';
import * as schema from '../db/schema';
import { ClientSyncEntityHandler } from './entity-sync-handlers/ClientSyncEntityHandler';
import { StoryClientSyncHandler } from './entity-sync-handlers/StoryClientSyncHandler';

interface SyncPreview {
  storyId: string;
  serverVersion: number;
  lastUpdatedAt: string;
  entityUpdates: StoryUpdate[];
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
    this.client = axios.create();
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

  public async configure(storyId: string, serverUrl: string | null) {
    this.storyId = storyId;
    if (serverUrl) {
      this.client.defaults.baseURL = serverUrl;
      // Add auth headers here once implemented
      console.log(`SyncEngineService configured for story ${storyId} with server: ${serverUrl}`);
    } else {
      console.warn('SyncEngineService configured without a server URL. Sync will be disabled.');
      this.stopSync();
    }
  }

  public startSync(intervalTimeMs?: number) {
    if (this.syncInterval) {
      console.log('Sync engine already running.');
      return;
    }

    if (!this.storyId) {
      console.error('Cannot start sync: storyId is not set. Call configure() first.');
      return;
    }

    if (!this.client.defaults.baseURL) {
      console.error('Cannot start sync: server URL is not set. Call configure() with a valid serverUrl.');
      return;
    }

    if (!this._db) {
      console.error('Cannot start sync: Drizzle client (db) is not set. Call setDbInstance() first.');
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

  private async performSync() {
    if (!this.storyId) {
      console.error('No storyId set for sync operation.');
      return;
    }

    if (!this.client.defaults.baseURL) {
      console.error('No server URL set for sync operation.');
      this.stopSync();
      return;
    }

    if (!this._db) {
      console.error('Drizzle client (db) is not initialized. Cannot perform sync.');
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
        console.error(`Story with ID ${this.storyId} not found locally.`);
        this.stopSync();
        return;
      }

      const sinceVersion = localStory.lastServerSyncedLog || 0;

      // 2. Call API for pull previews
      const response = await this.client.get<SyncPreview[]>(`/sync/pullpreviews/${this.storyId}?sinceVersion=${sinceVersion}`);
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
              console.warn(`No client sync handler registered for entity type: ${update.entity}`);
              continue;
            }

            try {
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
              console.error(`Error applying ${update.type} for entity ${update.entity} ID ${update.id}:`, handlerError);
            }
          }
        }

        const message = `${totalUpdates} updates available. Updated: ${entitiesUpdated.join(', ')}.`;
        ToastAndroid.show(message, ToastAndroid.LONG);

        // Update lastServerSyncedLog with the latest server version received
        const latestServerVersion = parseInt(previews[previews.length - 1].serverVersion.toString(), 10);
        await this._db.update(schema.stories)
          .set({ lastServerSyncedLog: latestServerVersion })
          .where(eq(schema.stories.id, this.storyId));

      } else {
        console.log(`No new sync previews for story ${this.storyId} since version ${sinceVersion}`);
      }

    } catch (error) {
      console.error('Error during sync operation:', error);
      // Implement more robust error handling (e.g., exponential backoff)
    }
  }
}

export const syncEngineService = SyncEngineService.getInstance();