import axios, { AxiosInstance } from 'axios';
import { eq } from 'drizzle-orm';
import { ToastAndroid } from 'react-native'; // For simple notifications, will refine later
import * as schema from '../db/schema';
import { AppDrizzleClient } from '../db'; // Import the type for the Drizzle client

interface SyncPreview {
  storyId: string;
  serverVersion: number; // Corrected type: API returns number
  lastUpdatedAt: string;
  entityUpdates: {
    entityType: string;
    ulid: string;
    operation: 'create' | 'update' | 'delete';
  }[];
}

class SyncEngineService {
  private static instance: SyncEngineService;
  private syncInterval: number | null = null;
  private storyId: string | null = null;
  private client: AxiosInstance;
  private intervalTimeMs: number = 30000; // Default to 30 seconds
  private _db: AppDrizzleClient | null = null; // Private property to hold the Drizzle client

  private constructor() {
    this.client = axios.create(); // Will be configured with base URL and auth in configure()
  }

  public static getInstance(): SyncEngineService {
    if (!SyncEngineService.instance) {
      SyncEngineService.instance = new SyncEngineService();
    }
    return SyncEngineService.instance;
  }

  // Method to inject the Drizzle client
  public setDbInstance(dbInstance: AppDrizzleClient) {
    this._db = dbInstance;
  }

  public async configure(storyId: string, serverUrl: string | null) {
    this.storyId = storyId;
    if (serverUrl) {
      this.client.defaults.baseURL = serverUrl;
      // Add auth headers here once implemented
      console.log(`SyncEngineService configured for story ${storyId} with server: ${serverUrl}`);
    } else {
      console.warn('SyncEngineService configured without a server URL. Sync will be disabled.');
      this.stopSync(); // Stop sync if no server URL is provided
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

    // Ensure db is set before starting sync
    if (!this._db) {
      console.error('Cannot start sync: Drizzle client (db) is not set. Call setDbInstance() first.');
      return;
    }

    this.intervalTimeMs = intervalTimeMs || this.intervalTimeMs;
    console.log(`Starting sync for story ${this.storyId} with interval ${this.intervalTimeMs / 1000}s`);

    // Perform an immediate sync first
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
    this.client.defaults.baseURL = undefined; // Clear base URL on stop
  }

  private async performSync() {
    if (!this.storyId) {
      console.error('No storyId set for sync operation.');
      return;
    }

    if (!this.client.defaults.baseURL) {
      console.error('No server URL set for sync operation.');
      this.stopSync(); // Stop sync if server URL disappears
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
        this.stopSync(); // Stop sync if story is gone
        return;
      }

      // Use lastServerSyncedLog as the 'sinceVersion' for the API call
      const sinceVersion = localStory.lastServerSyncedLog || 0; // Default to 0 if not set

      // 2. Call API for pull previews
      const response = await this.client.get<SyncPreview[]>(`/sync/pullpreviews/${this.storyId}?sinceVersion=${sinceVersion}`);
      const previews = response.data;

      if (previews && previews.length > 0) {
        console.log(`Received ${previews.length} sync previews for story ${this.storyId}`);

        let totalUpdates = 0;
        previews.forEach(preview => {
          totalUpdates += preview.entityUpdates.length;
        });

        // Display notification
        const message = `${totalUpdates} updates available.`;
        ToastAndroid.show(message, ToastAndroid.LONG); // This is a placeholder, will refine later

        // TODO: Implement actual application of changes and update local story lastServerSyncedLog
        // For now, just logging and updating lastServerSyncedLog
        const latestServerVersion = parseInt(previews[previews.length - 1].serverVersion.toString(), 10);
        await this._db.update(schema.stories)
          .set({ lastServerSyncedLog: latestServerVersion }) // Update with the latest server version received
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