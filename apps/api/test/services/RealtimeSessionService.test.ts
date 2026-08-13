import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeSessionService } from '../../src/services/RealtimeSessionService';

const listeners = new Map<string, Set<(event: any) => void>>();
let now = 1_000;
let service: RealtimeSessionService;
const canReadStory = vi.fn();
const getReadableStoryIds = vi.fn();
const logInfo = vi.fn();

beforeEach(() => {
  listeners.clear();
  vi.clearAllMocks();
  now = 1_000;
  canReadStory.mockResolvedValue(true);
  getReadableStoryIds.mockResolvedValue(['story-1']);
  service = new RealtimeSessionService({
    eventBus: {
      on: (key, callback) => {
        const callbacks = listeners.get(key) ?? new Set();
        callbacks.add(callback);
        listeners.set(key, callbacks);
      },
      off: (key, callback) => listeners.get(key)?.delete(callback),
      emit: (key, event) => listeners.get(key)?.forEach((callback) => callback(event)),
    },
    canReadStory,
    getReadableStoryIds,
    logInfo,
    now: () => now,
    createId: () => 'ticket-1',
  });
});

describe('RealtimeSessionService', () => {
  it('creates an expiring, one-time ticket', async () => {
    const ticket = service.createTicket({ userId: 'user-1', username: 'ana' });
    const socket = { send: vi.fn(), close: vi.fn() };

    expect(service.hasValidTicket(ticket)).toBe(true);
    await service.openEvents(socket, ticket);
    expect(service.hasValidTicket(ticket)).toBe(false);
    await service.openEvents(socket, ticket);
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it('rejects expired tickets', () => {
    const ticket = service.createTicket({ userId: 'user-1', username: 'ana' });
    now += 30_000;

    expect(service.hasValidTicket(ticket)).toBe(false);
  });

  it('subscribes authorized users, relays events, and removes every listener on close', async () => {
    const ticket = service.createTicket({ userId: 'user-1', username: 'ana' });
    const socket = { send: vi.fn() };

    await service.openEvents(socket, ticket);
    service.emitUserEvent('user-1', { type: 'friendships.changed' });
    await service.handleEventMessage(socket, JSON.stringify({ type: 'subscribe', storyId: 'story-2' }));
    service.closeEvents(socket);

    expect(getReadableStoryIds).toHaveBeenCalledWith('user-1');
    expect(canReadStory).toHaveBeenCalledWith('user-1', 'story-2', 'reader');
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'friendships.changed' }));
    expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('server.heartbeat'));
    expect(listeners.get('userUpdate:user-1')?.size).toBe(0);
    expect(listeners.get('storyUpdate:story-1')?.size).toBe(0);
    expect(listeners.get('storyUpdate:story-2')?.size).toBe(0);
  });

  it('ignores malformed and unauthorized subscription requests', async () => {
    const socket = { send: vi.fn(), realtimeUserId: 'user-1' };
    canReadStory.mockResolvedValue(false);

    await service.handleEventMessage(socket, '{invalid');
    await service.handleEventMessage(socket, { type: 'subscribe' });
    await service.handleEventMessage(socket, { type: 'subscribe', storyId: 'private-story' });

    expect(canReadStory).toHaveBeenCalledWith('user-1', 'private-story', 'reader');
    expect(listeners.get('storyUpdate:private-story')).toBeUndefined();
  });
});
