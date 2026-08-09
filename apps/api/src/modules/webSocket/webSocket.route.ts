import { Elysia } from 'elysia';
import { JWTPayload } from '../../index';
import { storyPermissionService } from '../../services/StoryPermissionService';
import { eventManager } from '../../utils/EventManager'; // Import eventManager
import { logger } from '../../utils/logger';
import { ulid } from 'ulid';

type RealtimeEvent = { type: 'story.changed'; storyId: string; maxOperationVersion?: number } | { type: 'friendships.changed' } | { type: 'stories.catalog-changed' };
const tickets = new Map<string, { user: JWTPayload; expiresAt: number }>();

export function createWebSocketTicket(user: JWTPayload): string {
  const ticket = ulid();
  tickets.set(ticket, { user, expiresAt: Date.now() + 30_000 });
  return ticket;
}

function takeTicket(ticket: string | undefined): JWTPayload | null {
  if (!ticket) return null;
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  return entry && entry.expiresAt > Date.now() ? entry.user : null;
}

function hasValidTicket(ticket: string | undefined): boolean {
  const entry = ticket ? tickets.get(ticket) : undefined;
  return !!entry && entry.expiresAt > Date.now();
}

export function emitUserEvent(userId: string, event: RealtimeEvent): void {
  eventManager.emit(`userUpdate:${userId}`, event);
}

function subscribeToStory(ws: any, userId: string, storyId: string): void {
  const key = `storyUpdate:${storyId}`;
  const callback = (event: { maxOperationVersion?: number }) => ws.send(JSON.stringify({
    type: 'story.changed', storyId, maxOperationVersion: event.maxOperationVersion,
  }));
  ws.storyCallbacks ??= new Map();
  const previous = ws.storyCallbacks.get(storyId);
  if (previous) eventManager.off(key, previous);
  ws.storyCallbacks.set(storyId, callback);
  eventManager.on(key, callback);
  logger.info('Realtime story subscription created', { userId, storyId });
}

export const wsRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
    .ws('/story/:storyid', {
        async beforeHandle({ params, set, user }) {
            if (!user) {
                set.status = 401;
                return 'Unauthorized: No user found. Please provide a valid JWT.';
            }

            const storyId = params.storyid;
            const userId = user.userId;

            const hasPermission = await storyPermissionService.hasPermission(userId, storyId, 'reader');

            if (!hasPermission) {
                set.status = 403;
                return 'Forbidden: You do not have permission to access this story.';
            }

            // If successful, do not return anything to allow the WebSocket connection to proceed.
        },
        open(ws) {
            const storyId = ws.data.params.storyid;
            ws.subscribe(storyId);
            logger.info('User joined story channel', { userId: ws.data.user?.userId, storyId });

            // Define the callback for story updates
            const storyUpdateCallback = (payload: any) => {
                // Only send to this specific WebSocket if it's subscribed to the storyId
                // Elysia's ws.send will handle sending to the connected client
                ws.send(JSON.stringify(payload));
            };

            // Subscribe this WebSocket to events for its storyId
            eventManager.on(`storyUpdate:${storyId}`, storyUpdateCallback);

            // Store the callback on the ws object so we can unsubscribe later
            (ws as any).storyUpdateCallback = storyUpdateCallback;
        },
        message(ws, {}) {
            // This channel is for listening to server-sent updates, not for receiving client messages.
            ws.send(JSON.stringify({"message": "This channel does not accept messages. Only listening."}));
        },
        close(ws) {
            const storyId = ws.data.params.storyid;
            ws.unsubscribe(storyId);
            logger.info('User left story channel', { userId: ws.data.user?.userId, storyId });

            // Unsubscribe this WebSocket from events
            if ((ws as any).storyUpdateCallback) {
                eventManager.off(`storyUpdate:${storyId}`, (ws as any).storyUpdateCallback);
            }
        }
    }
  )
  .ws('/events', {
    beforeHandle({ query, set }) {
      if (!hasValidTicket(query.ticket)) {
        set.status = 401;
        return 'Unauthorized WebSocket ticket.';
      }
    },
    async open(ws) {
      const user = takeTicket((ws.data as any).query?.ticket);
      if (!user) { ws.close(); return; }
      const callback = (event: RealtimeEvent) => ws.send(JSON.stringify(event));
      (ws as any).realtimeCallback = callback;
      (ws as any).realtimeUserId = user.userId;
      eventManager.on(`userUpdate:${user.userId}`, callback);
      logger.info('User joined realtime channel', { userId: user.userId });
      for (const storyId of await storyPermissionService.getReadableStoryIds(user.userId)) {
        subscribeToStory(ws as any, user.userId, storyId);
      }
      ws.send(JSON.stringify({ type: 'server.heartbeat', sentAt: new Date().toISOString() }));
    },
    async message(ws, message) {
      const userId = (ws as any).realtimeUserId as string | undefined;
      if (!userId) return;
      let request: { type?: string; storyId?: string };
      try { request = typeof message === 'string' ? JSON.parse(message) : message as any; } catch { return; }
      if (request.type !== 'subscribe' || !request.storyId) return;
      if (!await storyPermissionService.hasPermission(userId, request.storyId, 'reader')) return;
      subscribeToStory(ws as any, userId, request.storyId);
    },
    close(ws) {
      const userId = (ws as any).realtimeUserId;
      if (userId && (ws as any).realtimeCallback) eventManager.off(`userUpdate:${userId}`, (ws as any).realtimeCallback);
      for (const [storyId, callback] of ((ws as any).storyCallbacks ?? new Map())) eventManager.off(`storyUpdate:${storyId}`, callback);
      if (userId) logger.info('User left realtime channel', { userId });
    },
  });
