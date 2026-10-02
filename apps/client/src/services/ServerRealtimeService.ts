import type { AppDrizzleClient } from '../db';
import type { ServerSelect } from '../db/schema';
import { apiBaseUrl, apiUrl, createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';
import { createFriendshipService } from './FriendshipService';
import { createMessageService } from './MessageService';
import { createPublicationService } from './PublicationService';
import { createStoryInvitationService } from './StoryInvitationService';
import { entityEventEmitter } from '../utils/EventEmitter';
import type { ServerStoryPreview } from './SyncEngineService';
import { importNewServerStories } from './sync/importNewServerStories';

const RETRY_MS = 5_000;
/** How often the silence of the socket is checked. */
const WATCHDOG_MS = 15_000;
/**
 * Silence past this means the socket is half-open (NAT timeout, a drop with no FIN): the server
 * ticks a heartbeat every 30s, so 75s is over two missed beats plus slack. The socket is dropped
 * and reconnected rather than trusted.
 */
const SILENCE_LIMIT_MS = 75_000;

type ServerEvent =
  | { type: 'story.changed'; storyId: string }
  | { type: 'friendships.changed' }
  | { type: 'stories.catalog-changed' }
  | { type: 'story.collaborators-changed'; storyId: string }
  | { type: 'story-invitations.changed' }
  | { type: 'story.published'; storyId: string }
  | { type: 'messages.changed' }
  | { type: 'server.heartbeat' };

export interface RealtimeSyncEngine {
  requestSync(reason: 'websocket'): void;
  /** This server's socket was lost: the sync timer may have been relaxed while it was alive. */
  realtimeLinkChanged?(serverId: string): void;
  fetchServerStoryPreviews(server: ServerSelect): Promise<ServerStoryPreview[]>;
  downloadAndImportStory(
    queriedServerId: string,
    storyId: string,
    userId: string,
    role: ServerStoryPreview['role'],
  ): Promise<void>;
}

/** One server connection. WebSocket only signals work; HTTP remains authoritative. */
export class ServerRealtimeService {
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  /**
   * The watchdog only trusts silence as death once the server has proven it ticks: older servers
   * never send heartbeats, and treating their healthy idle sockets as half-open would churn a
   * reconnect every 75s for every user still on one.
   */
  private heartbeatArmed = false;
  private stopped = true;
  private storyId: string | undefined;
  private activeTasks = new Set<Promise<unknown>>();
  /**
   * Bumped on every (re)connect attempt: a ticket fetch that resolves after a newer attempt
   * started belongs to a stale generation and must not open a second socket.
   */
  private connectionAttempt = 0;

  constructor(
    private readonly db: AppDrizzleClient,
    private readonly server: ServerSelect,
    private readonly userId: string,
    private readonly syncEngine: RealtimeSyncEngine,
  ) {}

  /**
   * Alive and proven so: open, the server has shown it ticks, and it was heard from within the silence
   * the watchdog tolerates. The sync cadence relaxes only while this holds.
   */
  get isLive(): boolean {
    return (
      !this.stopped &&
      this.heartbeatArmed &&
      this.socket?.readyState === WebSocket.OPEN &&
      Date.now() - this.lastMessageAt <= SILENCE_LIMIT_MS
    );
  }

  start(storyId?: string): void {
    this.storyId = storyId;
    this.stopped = false;
    this.lastMessageAt = Date.now();
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(() => {
      if (
        this.stopped ||
        !this.heartbeatArmed ||
        !this.socket ||
        this.socket.readyState !== WebSocket.OPEN
      )
        return;
      if (Date.now() - this.lastMessageAt > SILENCE_LIMIT_MS) {
        console.log(`Realtime silent for too long (${this.server.name}); reconnecting.`);
        this.reconnectNow();
      }
    }, WATCHDOG_MS);
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
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = null;
    this.socket?.close();
    this.socket = null;
    this.heartbeatArmed = false;
    this.syncEngine.realtimeLinkChanged?.(this.server.id);
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
    const attempt = ++this.connectionAttempt;
    try {
      const client = createKeresAxiosInstance({ baseURL: this.server.url });
      client.setTokenProvider(authTokenManager);
      client.setActiveServer(this.server);
      const { data } = await client.post<{ ticket: string }>('/auth/ws-ticket');
      if (this.stopped || attempt !== this.connectionAttempt) return;
      const wsUrl =
        apiBaseUrl(this.server.url).replace(/^http/i, 'ws').replace(/\/$/, '') +
        `/ws/events?ticket=${encodeURIComponent(data.ticket)}`;
      const socket = new WebSocket(wsUrl);
      this.socket = socket;
      socket.onopen = () => {
        if (this.stopped || attempt !== this.connectionAttempt) {
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
          this.syncEngine.requestSync('websocket');
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
        // And for messages: a nudge missed while offline is not redelivered, so the conversations are looked
        // at again here. The first look at a server only takes note; a later one announces what arrived.
        this.track(
          createMessageService(this.db)
            .handleServerNudge(this.server)
            .catch((error) =>
              console.log('Realtime message refresh failed:', (error as Error)?.message || error),
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
        this.lastMessageAt = Date.now();
        if (!this.stopped) {
          this.track(
            this.handleEvent(event.data as string).catch((error) => {
              console.log('Realtime event handling failed:', (error as Error)?.message || error);
            }),
          );
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        // Only the current socket may schedule a reconnect: the late close of a replaced
        // socket (after an explicit reconnect, or a stale attempt) must not open a second one.
        if (this.socket !== socket) return;
        this.socket = null;
        this.heartbeatArmed = false;
        this.syncEngine.realtimeLinkChanged?.(this.server.id);
        this.scheduleReconnect();
      };
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
    if (event.type === 'server.heartbeat') {
      this.heartbeatArmed = true;
      return;
    }
    if (event.type === 'story.changed') {
      this.syncEngine.requestSync('websocket');
    } else if (event.type === 'friendships.changed') {
      await createFriendshipService(this.db).syncFriendshipsWithServer(this.userId, this.server);
      // An ended friendship takes its open story invitations with it.
      await createStoryInvitationService(this.db).syncWithServer(this.server);
    } else if (event.type === 'story.published') {
      await createPublicationService(this.db).syncPublicationsWithServer(this.server);
    } else if (event.type === 'stories.catalog-changed') {
      // A grant or revocation only takes effect on this socket's subscriptions at open: without a
      // fresh connection the socket keeps receiving nudges for stories it can no longer read (each
      // one driving a sync that 403s), and misses them for stories it just gained.
      this.reconnectNow();
      // An invitation this user accepted (on any device), say: the story is downloaded and listed.
      // ...and one this user lost (removed, or left on another device) is dropped from this one.
      await importNewServerStories(this.db, this.syncEngine, this.server);
    } else if (event.type === 'story.collaborators-changed') {
      // Somebody joined, left or was removed: whoever shows the collaborators reads them again.
      entityEventEmitter.emit('story_collaborators_changed', event.storyId, this.server.id);
    } else if (event.type === 'story-invitations.changed') {
      await createStoryInvitationService(this.db).syncWithServer(this.server);
    } else if (event.type === 'messages.changed') {
      await createMessageService(this.db).handleServerNudge(this.server);
    }
  }

  /**
   * Drops the current socket and connects again immediately, so the server rebuilds the
   * story subscriptions from the current permissions. Any ticket fetch still in flight is
   * invalidated first: when it lands it must not open a second socket next to the new one.
   */
  private reconnectNow(): void {
    if (this.stopped) return;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const previous = this.socket;
    this.socket = null;
    this.connectionAttempt += 1;
    // A fresh window for the new socket, re-armed by its opening heartbeat.
    this.heartbeatArmed = false;
    this.syncEngine.realtimeLinkChanged?.(this.server.id);
    this.lastMessageAt = Date.now();
    previous?.close();
    this.track(this.connect());
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
