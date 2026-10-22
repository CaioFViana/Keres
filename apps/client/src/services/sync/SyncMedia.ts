import type { AppDrizzleClient } from '@/src/db';
import type { ServerSelect } from '@/src/db/schema';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import type { KeresAxiosInstance } from '@/src/services/api/apiClient';
import type { MediaSyncService } from '@/src/services/media/MediaSyncService';
import { createMediaSyncService } from '@/src/services/media/MediaSyncService';
import { logger } from '@/src/utils/logging/logger';

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
        logger.debug(
          `Media sync for story ${storyId}: ${summary.uploaded} uploaded, ${summary.downloaded} downloaded, ${summary.failed} failed.`,
        );
        entityEventEmitter.emit('gallery_changed', storyId);
      }
      return summary.offline;
    } catch (error) {
      logger.debug(`Media sync skipped for story ${storyId}.`, error);
      return false;
    }
  }
}
