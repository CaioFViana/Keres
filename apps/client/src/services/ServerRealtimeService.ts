import { AppDrizzleClient } from '../db';
import { ServerSelect } from '../db/schema';
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
          // Mesmo motivo do refresh de friendships abaixo: eventos emitidos enquanto este
          // cliente estava desconectado nunca são reentregues (o eventManager do servidor é
          // em memória, não uma fila durável) - sem isto, uma história só voltava a
          // sincronizar na próxima edição local, deixando o estado preso por tempo
          // indefinido depois de uma queda de rede.
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
        // Mesma razão, para publicações: quem esteve offline enquanto uma história que ele lê
        // ganhou versão pública só descobre isso aqui - o aviso nasce da diferença com o
        // espelho local, não do evento em si.
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
      // Sem isto, uma história nova chegando por este evento (ex.: alguém te adicionou como
      // colaborador) fica salva no banco local mas invisível em `StorySelectionScreen`, que lê
      // `useStoryListStore` - a lista só reflete o banco quando algo pede um `fetchStories` novo.
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
