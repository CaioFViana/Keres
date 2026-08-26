import type { AppDrizzleClient } from '../db';
import type { ServerSelect } from '../db/schema';
import { useStoryListStore } from '../state/storyListStore';
import { apiBaseUrl, apiUrl, createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';
import { createFriendshipService } from './FriendshipService';
import { createPublicationService } from './PublicationService';
import { SyncEngineService } from './SyncEngineService';
import { createStoryService } from './storymanagement/StoryService';

const RETRY_MS = 5_000;

type ServerEvent =
  | { type: 'story.changed'; storyId: string }
  | { type: 'friendships.changed' }
  | { type: 'stories.catalog-changed' }
  | { type: 'story.published'; storyId: string }
  | { type: 'server.heartbeat' };

/** One server connection. WebSocket only signals work; HTTP remains authoritative. */
export class ServerRealtimeService {
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private storyId: string | undefined;
  private activeTasks = new Set<Promise<unknown>>();

  constructor(
    private readonly db: AppDrizzleClient,
    private readonly server: ServerSelect,
    private readonly userId: string,
  ) {}

  start(storyId?: string): void {
    this.storyId = storyId;
    this.stopped = false;
    this.track(this.connect());
  }

  subscribeToStory(storyId: string | undefined): void {
    this.storyId = storyId;
    if (storyId && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'subscribe', storyId }));
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.socket?.close();
    this.socket = null;
    await Promise.allSettled(Array.from(this.activeTasks));
  }

  private track<T>(task: Promise<T>): Promise<T> {
    this.activeTasks.add(task);
    void task.then(
      () => this.activeTasks.delete(task),
      () => this.activeTasks.delete(task),
    );
    return task;
  }

  private async connect(): Promise<void> {
    try {
      const client = createKeresAxiosInstance({ baseURL: this.server.url });
      client.setTokenProvider(authTokenManager);
      client.setActiveServer(this.server);
      const { data } = await client.post<{ ticket: string }>('/auth/ws-ticket');
      if (this.stopped) return;
      const wsUrl =
        apiBaseUrl(this.server.url).replace(/^http/i, 'ws').replace(/\/$/, '') +
        `/ws/events?ticket=${encodeURIComponent(data.ticket)}`;
      const socket = new WebSocket(wsUrl);
      this.socket = socket;
      socket.onopen = () => {
        if (this.stopped) {
          socket.close();
          return;
        }
        console.log(`Realtime connected: ${this.server.name}`);
        if (this.storyId) {
          socket.send(JSON.stringify({ type: 'subscribe', storyId: this.storyId }));
          // The same reason as the friendships refresh below: events emitted while this client was disconnected
          // are never redelivered (the server's eventManager is in memory, not a durable queue) - without this, a
          // story only started synchronizing again on the next local edit, leaving state stuck for an indefinite
          // time after a network drop.
          SyncEngineService.getInstance().requestSync('websocket');
        }
        // WebSocket events are intentionally ephemeral. Refresh once on every connection so
        // profile/friendship changes made while this device was offline are not left stale
        // merely because their notification was missed.
        this.track(
          createFriendshipService(this.db)
            .syncFriendshipsWithServer(this.userId, this.server)
            .catch((error) =>
              console.log(
                'Realtime friendship refresh failed:',
                (error as Error)?.message || error,
              ),
            ),
        );
        // The same reason, for publications: whoever was offline while a story they read gained a public
        // version only finds out here - the notice comes from the difference against the local mirror, not from
        // the event itself.
        this.track(
          createPublicationService(this.db)
            .syncPublicationsWithServer(this.server)
            .catch((error) =>
              console.log(
                'Realtime publication refresh failed:',
                (error as Error)?.message || error,
              ),
            ),
        );
      };
      socket.onmessage = (event) => {
        if (!this.stopped) {
          this.track(
            this.handleEvent(event.data as string).catch((error) => {
              console.log('Realtime event handling failed:', (error as Error)?.message || error);
            }),
          );
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => this.scheduleReconnect();
    } catch (error) {
      console.log(
        `Realtime connection failed for ${this.server.name}; retrying after health check.`,
        (error as Error)?.message || error,
      );
      this.scheduleReconnect();
    }
  }

  private async handleEvent(raw: string): Promise<void> {
    let event: ServerEvent;
    try {
      event = JSON.parse(raw) as ServerEvent;
    } catch {
      return;
    }
    console.log(`Realtime event from ${this.server.name}: ${event.type}`);
    if (event.type === 'story.changed') {
      SyncEngineService.getInstance().requestSync('websocket');
    } else if (event.type === 'friendships.changed') {
      await createFriendshipService(this.db).syncFriendshipsWithServer(this.userId, this.server);
    } else if (event.type === 'story.published') {
      await createPublicationService(this.db).syncPublicationsWithServer(this.server);
    } else if (event.type === 'stories.catalog-changed') {
      const engine = SyncEngineService.getInstance();
      const previews = await engine.fetchServerStoryPreviews(this.server);
      const localStories = await this.db.query.stories.findMany({ columns: { id: true } });
      const localIds = new Set(localStories.map((story) => story.id));
      let downloadedAny = false;
      for (const preview of previews) {
        if (!localIds.has(preview.storyId)) {
          await engine.downloadAndImportStory(
            this.server.id,
            preview.storyId,
            this.server.idUser,
            preview.role,
          );
          downloadedAny = true;
        }
      }
      // Without this, a new story arriving through this event (somebody adding you as a collaborator, say)
      // is saved in the local database but invisible in `StorySelectionScreen`, which reads
      // `useStoryListStore` - the list only reflects the database when something asks for a fresh
      // `fetchStories`.
      if (downloadedAny) {
        await useStoryListStore.getState().fetchStories(createStoryService(this.db));
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      try {
        await fetch(apiUrl(this.server.url, '/kerescheck'));
      } catch {
        /* retry below */
      }
      if (!this.stopped) this.track(this.connect());
    }, RETRY_MS);
  }
}
