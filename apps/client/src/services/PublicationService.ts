import { stories } from '@/src/db/schemas/stories';
import type {
  StoryPublicationInsert,
  StoryPublicationSelect,
} from '@/src/db/schemas/storyPublications';
import { storyPublications } from '@/src/db/schemas/storyPublications';
import type { ServerSelect } from '@/src/db/schemas/servers';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import { useNotificationStore } from '../state/notificationStore';
import { entityEventEmitter } from '../utils/EventEmitter';
import i18n from '../utils/i18n';
import { isOfflineError } from './apiClient';
import { publicationApiService } from './PublicationApiService';

/**
 * The local mirror of the public versions, and the notice that one has appeared.
 *
 * The design is the same as `FriendshipService.performFriendshipSync`, and for the same reason: the
 * server sends `story.published` over the WebSocket, but its bus is in memory and does not
 * redeliver anything to whoever was offline. So the notice is not born from the event - it is born from the
 * *difference* between what this device already had and what the server answers, and the app redoes
 * that query on every reconnection. Somebody who spent a week offline gets the notice on coming back.
 */

// A reconnection and an event may ask for the same update at almost the same time, and Expo's SQLite
// does not run two write transactions at once. The same protection friendship already uses.
const publicationSyncInFlight = new Map<string, Promise<void>>();

export const createPublicationService = (db: AppDrizzleClient) => new PublicationService(db);

export class PublicationService {
  constructor(private db: AppDrizzleClient) {}

  async getPublicationsForStory(storyId: string): Promise<StoryPublicationSelect[]> {
    return this.db
      .select()
      .from(storyPublications)
      .where(eq(storyPublications.storyId, storyId))
      .orderBy(desc(storyPublications.createdAt))
      .all();
  }

  async syncPublicationsWithServer(server: ServerSelect): Promise<void> {
    const inFlight = publicationSyncInFlight.get(server.id);
    if (inFlight) {
      return inFlight;
    }
    const sync = this.performPublicationSync(server);
    publicationSyncInFlight.set(server.id, sync);
    sync
      .finally(() => publicationSyncInFlight.delete(server.id))
      .catch(() => {
        // The original promise is given back to the caller, which handles the error. This catch exists
        // only so the finally's chaining does not become an unhandled rejection.
      });
    return sync;
  }

  private async performPublicationSync(server: ServerSelect): Promise<void> {
    let remote: Awaited<ReturnType<typeof publicationApiService.listVisible>>;
    try {
      // Before the transaction: a network round trip inside it would hold the database for the whole way.
      remote = await publicationApiService.listVisible(server);
    } catch (error) {
      if (isOfflineError(error)) {
        return;
      }
      throw error;
    }

    const stories = await this.localStories(remote.map((publication) => publication.storyId));
    const notifications: string[] = [];

    await this.db.transaction(async (tx) => {
      const local = await tx
        .select()
        .from(storyPublications)
        .where(eq(storyPublications.serverId, server.id))
        .all();
      const localById = new Map(local.map((row) => [row.id, row]));

      // A version deleted by the owner disappears from here too - the mirror reflects the server.
      const remoteIds = new Set(remote.map((publication) => publication.id));
      const goneIds = local.filter((row) => !remoteIds.has(row.id)).map((row) => row.id);
      if (goneIds.length > 0) {
        await tx.delete(storyPublications).where(inArray(storyPublications.id, goneIds)).run();
      }

      // This server's first synchronization: everything that exists already existed before this device
      // knew the feature existed. Record it as already notified, otherwise the person would take a
      // flood of notices about old versions.
      const firstSync = local.length === 0;

      for (const publication of remote) {
        const known = localById.get(publication.id);
        const isNew = !known;
        const row: StoryPublicationInsert = {
          id: publication.id,
          serverId: server.id,
          storyId: publication.storyId,
          label: publication.label,
          operationVersion: publication.operationVersion,
          byteSize: publication.byteSize,
          createdAt: new Date(publication.createdAt),
          notified: isNew ? firstSync : known.notified,
        };

        await tx
          .insert(storyPublications)
          .values(row)
          .onConflictDoUpdate({ target: storyPublications.id, set: row })
          .run();

        if (isNew && !firstSync) {
          const story = stories.get(publication.storyId);
          // The publisher is the owner, so telling them about what they have just done themselves is noise. The
          // event still reaches their devices - it is what keeps this list up to date -,
          // but the on-screen notice is only for whoever reads or writes somebody else's story.
          if (story?.myRole !== 'owner') {
            notifications.push(
              i18n.t('story_version_published', {
                title: story?.title ?? i18n.t('a_story'),
                label: publication.label,
              }),
            );
          }
          await tx
            .update(storyPublications)
            .set({ notified: true })
            .where(eq(storyPublications.id, publication.id))
            .run();
        }
      }
    });

    // Outside the transaction: showing a notice must not be grounds for undoing the write.
    const showNotification = useNotificationStore.getState().showNotification;
    for (const message of notifications) {
      showNotification(message, 'info');
    }
    entityEventEmitter.emit('publications_changed');
  }

  /**
   * The stories mentioned, as this device knows them: the title (so the notice does not say only an
   * id) and the person's role in them (so the owner is not told about their own publication).
   */
  private async localStories(
    storyIds: string[],
  ): Promise<Map<string, { title: string; myRole: string | null }>> {
    const unique = [...new Set(storyIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ id: stories.id, title: stories.title, myRole: stories.myRole })
      .from(stories)
      .where(and(inArray(stories.id, unique), eq(stories.isDeleted, false)))
      .all();
    return new Map(rows.map((row) => [row.id, { title: row.title, myRole: row.myRole }]));
  }
}
