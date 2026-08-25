import type { AppDrizzleClient } from '../../db';
import type { ServerSelect } from '../../db/schema';
import { entityEventEmitter } from '../../utils/EventEmitter';
import type { KeresAxiosInstance } from '../apiClient';
import type { MediaSyncService } from '../MediaSyncService';
import { createMediaSyncService } from '../MediaSyncService';

interface SyncMediaContext {
  db: () => AppDrizzleClient | null;
  storyId: () => string | null;
  server: () => ServerSelect | null;
  client: () => KeresAxiosInstance;
}

/** Reconciles gallery files after the metadata cycle. */
export class SyncMedia {
  private service: MediaSyncService | null = null;

  public constructor(private readonly context: SyncMediaContext) {}

  public reset(): void {
    this.service = null;
  }

  public async sync(): Promise<boolean> {
    const db = this.context.db();
    const storyId = this.context.storyId();
    const server = this.context.server();
    if (!db || !storyId || !server) return false;

    try {
      this.service ??= createMediaSyncService(db);
      const summary = await this.service.syncStoryMedia(this.context.client(), server, storyId);
      if (summary.uploaded > 0 || summary.downloaded > 0) {
        console.log(
          `Media sync for story ${storyId}: ${summary.uploaded} uploaded, ${summary.downloaded} downloaded, ${summary.failed} failed.`,
        );
        entityEventEmitter.emit('gallery_changed', storyId);
      }
      return summary.offline;
    } catch (error) {
      console.log(`Media sync skipped for story ${storyId}.`, error);
      return false;
    }
  }
}
