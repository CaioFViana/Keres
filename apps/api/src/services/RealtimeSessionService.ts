import { ulid } from 'ulid';
import type { JWTPayload } from '../index';

export type RealtimeEvent =
  | { type: 'story.changed'; storyId: string; maxOperationVersion?: number }
  | { type: 'friendships.changed' }
  | { type: 'stories.catalog-changed' }
  /**
   * A story gained (or lost) a public version. It goes to the owner and to everybody with permission on
   * it. With no content payload, like the others: it is only a nudge for the client to redo the
   * authoritative GET - the bus is in memory and resends nothing to whoever was offline, so the client
   * also redoes that GET on every reconnection.
   */
  | { type: 'story.published'; storyId: string };

type EventBus = {
  on: (key: string, callback: (event: never) => void) => void;
  off: (key: string, callback: (event: never) => void) => void;
  emit: (key: string, event: RealtimeEvent) => void;
};

export type RealtimeSocket = {
  send: (message: string) => void;
  close?: () => void;
  storyCallbacks?: Map<string, (event: { maxOperationVersion?: number }) => void>;
  realtimeCallback?: (event: RealtimeEvent) => void;
  realtimeUserId?: string;
  stopHeartbeat?: () => void;
};

/** How often a live socket is reminded the server is still there. The client treats a socket silent for well over twice this as half-open and reconnects. */
export const REALTIME_HEARTBEAT_MS = 30_000;

interface RealtimeSessionDependencies {
  eventBus: EventBus;
  canReadStory: (userId: string, storyId: string, role: 'reader') => Promise<boolean>;
  getReadableStoryIds: (userId: string) => Promise<string[]>;
  logInfo: (message: string, meta: Record<string, unknown>) => void;
  now?: () => number;
  createId?: () => string;
  /** Starts the heartbeat ticks; returns a stop function. Injectable so tests drive ticks by hand. */
  startHeartbeat?: (tick: () => void) => () => void;
}

/** Ticket and subscription logic, independent of Elysia's WebSocket adapter. */
export class RealtimeSessionService {
  private readonly tickets = new Map<string, { user: JWTPayload; expiresAt: number }>();
  private readonly now: () => number;
  private readonly createId: () => string;

  constructor(private readonly dependencies: RealtimeSessionDependencies) {
    this.now = dependencies.now ?? Date.now;
    this.createId = dependencies.createId ?? ulid;
  }

  /** Test-only visibility into how many tickets are held, to verify sweeping actually bounds
   *  the Map's growth instead of just re-checking the same public expiry behavior. */
  get pendingTicketCount(): number {
    return this.tickets.size;
  }

  createTicket(user: JWTPayload): string {
    this.sweepExpiredTickets();
    const ticket = this.createId();
    this.tickets.set(ticket, { user, expiresAt: this.now() + 30_000 });
    return ticket;
  }

  /**
   * A ticket that's created but never consumed (client aborts, the WebSocket connection
   * never actually opens) would otherwise stay in `tickets` forever - `takeTicket` only ever
   * removes an entry on a successful connect. Swept opportunistically here instead of on a
   * timer, so the Map's steady-state size tracks recent ticket-creation volume instead of
   * growing unboundedly over the process's uptime.
   */
  private sweepExpiredTickets(): void {
    const now = this.now();
    for (const [ticket, entry] of this.tickets) {
      if (entry.expiresAt <= now) {
        this.tickets.delete(ticket);
      }
    }
  }

  hasValidTicket(ticket: string | undefined): boolean {
    const entry = ticket ? this.tickets.get(ticket) : undefined;
    return !!entry && entry.expiresAt > this.now();
  }

  emitUserEvent(userId: string, event: RealtimeEvent): void {
    this.dependencies.eventBus.emit(`userUpdate:${userId}`, event);
  }

  private takeTicket(ticket: string | undefined): JWTPayload | null {
    if (!ticket) return null;
    const entry = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    return entry && entry.expiresAt > this.now() ? entry.user : null;
  }

  subscribeToStory(socket: RealtimeSocket, userId: string, storyId: string): void {
    const key = `storyUpdate:${storyId}`;
    const callback = (event: { maxOperationVersion?: number }) =>
      socket.send(
        JSON.stringify({
          type: 'story.changed',
          storyId,
          maxOperationVersion: event.maxOperationVersion,
        }),
      );
    socket.storyCallbacks ??= new Map();
    const previous = socket.storyCallbacks.get(storyId);
    if (previous) this.dependencies.eventBus.off(key, previous);
    socket.storyCallbacks.set(storyId, callback);
    this.dependencies.eventBus.on(key, callback);
    this.dependencies.logInfo('Realtime story subscription created', { userId, storyId });
  }

  async openEvents(socket: RealtimeSocket, ticket: string | undefined): Promise<void> {
    const user = this.takeTicket(ticket);
    if (!user) {
      socket.close?.();
      return;
    }
    const callback = (event: RealtimeEvent) => socket.send(JSON.stringify(event));
    socket.realtimeCallback = callback;
    socket.realtimeUserId = user.userId;
    this.dependencies.eventBus.on(`userUpdate:${user.userId}`, callback);
    this.dependencies.logInfo('User joined realtime channel', { userId: user.userId });
    // Every open socket owns its subscription registry, even before its first readable story:
    // a rejected subscribe must read as "not subscribed" instead of "no registry".
    socket.storyCallbacks = new Map();
    try {
      for (const storyId of await this.dependencies.getReadableStoryIds(user.userId)) {
        this.subscribeToStory(socket, user.userId, storyId);
      }
    } catch {
      // A half-subscribed socket is worse than none: the client's `onopen` already fired, so it
      // believes it is live while story nudges never arrive. Roll the subscriptions back and close,
      // so the client reconnects with a fresh ticket instead of waiting on a dead channel.
      this.closeEvents(socket);
      socket.close?.();
      return;
    }
    const sendHeartbeat = () => {
      socket.send(
        JSON.stringify({ type: 'server.heartbeat', sentAt: new Date(this.now()).toISOString() }),
      );
    };
    sendHeartbeat();
    // A half-open socket (NAT timeout, a network drop with no FIN) otherwise looks alive forever
    // while delivering nothing. The ticks let the client notice the silence and reconnect - and a
    // tick that cannot even be sent reaps the socket from this side.
    socket.stopHeartbeat?.();
    const startHeartbeat =
      this.dependencies.startHeartbeat ??
      ((tick: () => void) => {
        const timer = setInterval(tick, REALTIME_HEARTBEAT_MS);
        return () => clearInterval(timer);
      });
    socket.stopHeartbeat = startHeartbeat(() => {
      try {
        sendHeartbeat();
      } catch {
        socket.stopHeartbeat?.();
        socket.close?.();
      }
    });
  }

  async handleEventMessage(socket: RealtimeSocket, message: unknown): Promise<void> {
    const userId = socket.realtimeUserId;
    if (!userId) return;
    let request: { type?: string; storyId?: string };
    try {
      request =
        typeof message === 'string'
          ? JSON.parse(message)
          : (message as { type?: string; storyId?: string });
    } catch {
      return;
    }
    // A JSON `null` (or a primitive frame) is not an object: reading `.type` off it throws
    // instead of being ignored like every other malformed message.
    if (!request || typeof request !== 'object') return;
    if (request.type !== 'subscribe' || !request.storyId) return;
    if (!(await this.dependencies.canReadStory(userId, request.storyId, 'reader'))) return;
    this.subscribeToStory(socket, userId, request.storyId);
  }

  closeEvents(socket: RealtimeSocket): void {
    const userId = socket.realtimeUserId;
    if (userId && socket.realtimeCallback)
      this.dependencies.eventBus.off(`userUpdate:${userId}`, socket.realtimeCallback);
    for (const [storyId, callback] of socket.storyCallbacks ?? new Map()) {
      this.dependencies.eventBus.off(`storyUpdate:${storyId}`, callback);
    }
    // The registry dies with the socket: a subscription request arriving after the close must read
    // as "never opened" instead of reusing the previous identity, and a second `openEvents` on the
    // same object must not orphan the first one's listeners.
    socket.realtimeCallback = undefined;
    socket.realtimeUserId = undefined;
    socket.storyCallbacks = undefined;
    socket.stopHeartbeat?.();
    socket.stopHeartbeat = undefined;
    if (userId) this.dependencies.logInfo('User left realtime channel', { userId });
  }
}
