import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeSessionService } from '../../src/services/RealtimeSessionService';

const listeners = new Map<string, Set<(event: never) => void>>();
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
      emit: (key, event) =>
        listeners.get(key)?.forEach((callback) => callback(event as never)),
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
    await service.handleEventMessage(
      socket,
      JSON.stringify({ type: 'subscribe', storyId: 'story-2' }),
    );
    service.closeEvents(socket);

    expect(getReadableStoryIds).toHaveBeenCalledWith('user-1');
    expect(canReadStory).toHaveBeenCalledWith('user-1', 'story-2', 'reader');
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'friendships.changed' }));
    expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('server.heartbeat'));
    expect(listeners.get('userUpdate:user-1')?.size).toBe(0);
    expect(listeners.get('storyUpdate:story-1')?.size).toBe(0);
    expect(listeners.get('storyUpdate:story-2')?.size).toBe(0);
  });

  it('sweeps expired unconsumed tickets instead of leaking them forever', () => {
    const createId = vi.fn().mockReturnValueOnce('t1').mockReturnValueOnce('t2');
    service = new RealtimeSessionService({
      eventBus: {
        on: (key, callback) => {
          const callbacks = listeners.get(key) ?? new Set();
          callbacks.add(callback);
          listeners.set(key, callbacks);
        },
        off: (key, callback) => listeners.get(key)?.delete(callback),
        emit: (key, event) =>
          listeners.get(key)?.forEach((callback) => callback(event as never)),
      },
      canReadStory,
      getReadableStoryIds,
      logInfo,
      now: () => now,
      createId,
    });

    service.createTicket({ userId: 'user-1', username: 'ana' }); // 't1' - never gets consumed
    expect(service.pendingTicketCount).toBe(1);

    now += 30_000; // 't1' is now expired
    service.createTicket({ userId: 'user-2', username: 'bea' }); // 't2' - sweeps 't1' first

    expect(service.pendingTicketCount).toBe(1);
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

  it('replaces a previous subscription to the same story instead of delivering duplicate realtime events', () => {
    const socket = { send: vi.fn() };

    service.subscribeToStory(socket, 'user-1', 'story-1');
    service.subscribeToStory(socket, 'user-1', 'story-1');
    listeners
      .get('storyUpdate:story-1')
      ?.forEach((listener) => listener({ maxOperationVersion: 42 } as never));

    expect(listeners.get('storyUpdate:story-1')?.size).toBe(1);
    expect(socket.send).toHaveBeenCalledTimes(1);
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'story.changed', storyId: 'story-1', maxOperationVersion: 42 }),
    );
  });

  it('does not authorize a subscription request before a valid realtime ticket opened the socket', async () => {
    const socket = { send: vi.fn() };

    await service.handleEventMessage(
      socket,
      JSON.stringify({ type: 'subscribe', storyId: 'story-1' }),
    );

    expect(canReadStory).not.toHaveBeenCalled();
    expect(listeners.get('storyUpdate:story-1')).toBeUndefined();
  });
});
