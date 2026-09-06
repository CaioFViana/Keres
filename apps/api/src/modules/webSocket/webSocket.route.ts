import { Elysia } from 'elysia';
import type { JWTPayload } from '../../index';
import { storyPermissionService } from '../../services/StoryPermissionService';
import { eventManager } from '../../utils/EventManager'; // Import eventManager
import { logger } from '../../utils/logger';
import {
  RealtimeSessionService,
  type RealtimeEvent,
  type RealtimeSocket,
} from '../../services/RealtimeSessionService';

const realtimeSessions = new RealtimeSessionService({
  eventBus: eventManager,
  // Late forwarding: StoryPermissionService is part of SyncService's graph, which in turn registers
  // wsRoutes. Reading the method at call time avoids depending on the evaluation order of those
  // circular modules.
  canReadStory: (userId, storyId, role) =>
    storyPermissionService.hasPermission(userId, storyId, role),
  getReadableStoryIds: (userId) => storyPermissionService.getReadableStoryIds(userId),
  logInfo: logger.info.bind(logger),
});

export const createWebSocketTicket = (user: JWTPayload) => realtimeSessions.createTicket(user);
export const emitUserEvent = (userId: string, event: RealtimeEvent) =>
  realtimeSessions.emitUserEvent(userId, event);

export const wsRoutes = new Elysia().decorate('user', null as JWTPayload | null).ws('/events', {
  beforeHandle({ query, set }) {
    if (!realtimeSessions.hasValidTicket(query.ticket)) {
      set.status = 401;
      return 'Unauthorized WebSocket ticket.';
    }
  },
  async open(ws) {
    const data = ws.data as unknown as { query?: { ticket?: string } };
    await realtimeSessions.openEvents(ws as unknown as RealtimeSocket, data.query?.ticket);
  },
  async message(ws, message) {
    await realtimeSessions.handleEventMessage(ws as unknown as RealtimeSocket, message);
  },
  close(ws) {
    realtimeSessions.closeEvents(ws as unknown as RealtimeSocket);
  },
});
