import { AppDrizzleClient } from '../db';
import { ServerSelect } from '../db/schema';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';
import { createFriendshipService } from './FriendshipService';
import { SyncEngineService } from './SyncEngineService';

const RETRY_MS = 5_000;

type ServerEvent =
  | { type: 'story.changed'; storyId: string }
  | { type: 'friendships.changed' }
  | { type: 'stories.catalog-changed' }
  | { type: 'server.heartbeat' };

/** One server connection. WebSocket only signals work; HTTP remains authoritative. */
export class ServerRealtimeService {
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private storyId: string | undefined;

  constructor(private readonly db: AppDrizzleClient, private readonly server: ServerSelect, private readonly userId: string) {}

  start(storyId?: string): void {
    this.storyId = storyId;
    this.stopped = false;
    this.connect();
  }

  subscribeToStory(storyId: string | undefined): void {
    this.storyId = storyId;
    if (storyId && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'subscribe', storyId }));
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  private async connect(): Promise<void> {
    try {
      const client = createKeresAxiosInstance({ baseURL: this.server.url });
      client.setTokenProvider(authTokenManager);
      client.setActiveServer(this.server);
      const { data } = await client.post<{ ticket: string }>('/auth/ws-ticket');
      const wsUrl = this.server.url.replace(/^http/i, 'ws').replace(/\/$/, '') + `/ws/events?ticket=${encodeURIComponent(data.ticket)}`;
      const socket = new WebSocket(wsUrl);
      this.socket = socket;
      socket.onopen = () => {
        console.log(`Realtime connected: ${this.server.name}`);
        if (this.storyId) socket.send(JSON.stringify({ type: 'subscribe', storyId: this.storyId }));
      };
      socket.onmessage = (event) => this.handleEvent(event.data as string);
      socket.onerror = () => socket.close();
      socket.onclose = () => this.scheduleReconnect();
    } catch (error) {
      console.log(`Realtime connection failed for ${this.server.name}; retrying after health check.`, (error as Error)?.message || error);
      this.scheduleReconnect();
    }
  }

  private async handleEvent(raw: string): Promise<void> {
    let event: ServerEvent;
    try { event = JSON.parse(raw) as ServerEvent; } catch { return; }
    console.log(`Realtime event from ${this.server.name}: ${event.type}`);
    if (event.type === 'story.changed') {
      SyncEngineService.getInstance().requestSync('websocket');
    } else if (event.type === 'friendships.changed') {
      await createFriendshipService(this.db).syncFriendshipsWithServer(this.userId, this.server);
    } else if (event.type === 'stories.catalog-changed') {
      const engine = SyncEngineService.getInstance();
      const previews = await engine.fetchServerStoryPreviews(this.server);
      const localStories = await this.db.query.stories.findMany({ columns: { id: true } });
      const localIds = new Set(localStories.map((story) => story.id));
      for (const preview of previews) {
        if (!localIds.has(preview.storyId)) {
          await engine.downloadAndImportStory(this.server.id, preview.storyId, this.server.idUser, preview.role);
        }
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      try { await fetch(`${this.server.url.replace(/\/$/, '')}/kerescheck`); } catch { /* retry below */ }
      if (!this.stopped) this.connect();
    }, RETRY_MS);
  }
}
