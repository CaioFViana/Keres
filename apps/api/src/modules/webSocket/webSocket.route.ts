import { Elysia } from 'elysia';
import type { JWTPayload } from '../../index';
import { storyPermissionService } from '../../services/StoryPermissionService';
import { eventManager } from '../../utils/EventManager';
import { AppError } from '../../utils/errors';
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

/**
 * Testable seam over the module's session registry. No ws upgrade exists in-process
 * (`app.handle` never runs the `.ws()` block below), so the permission forwarding
 * above and every flow here are covered by integration tests driving these functions
 * with a real database and a fake socket instead - the `.ws()` block stays as pure
 * delegation and is the only part left to a real connection.
 */
export function hasValidRealtimeTicket(ticket: string | undefined): boolean {
  return realtimeSessions.hasValidTicket(ticket);
}

export function assertRealtimeTicket(ticket: string | undefined): void {
  if (!hasValidRealtimeTicket(ticket)) {
    throw new AppError(401, 'Unauthorized WebSocket ticket.');
  }
}

export function openRealtimeEvents(
  socket: RealtimeSocket,
  ticket: string | undefined,
): Promise<void> {
  return realtimeSessions.openEvents(socket, ticket);
}

export function handleRealtimeEventMessage(
  socket: RealtimeSocket,
  message: unknown,
): Promise<void> {
  return realtimeSessions.handleEventMessage(socket, message);
}

export function closeRealtimeEvents(socket: RealtimeSocket): void {
  realtimeSessions.closeEvents(socket);
}

export const wsRoutes = new Elysia().decorate('user', null as JWTPayload | null).ws('/events', {
  beforeHandle({ query }) {
    assertRealtimeTicket(query.ticket);
  },
  async open(ws) {
    const data = ws.data as unknown as { query?: { ticket?: string } };
    await openRealtimeEvents(ws as unknown as RealtimeSocket, data.query?.ticket);
  },
  async message(ws, message) {
    await handleRealtimeEventMessage(ws as unknown as RealtimeSocket, message);
  },
  close(ws) {
    closeRealtimeEvents(ws as unknown as RealtimeSocket);
  },
});
