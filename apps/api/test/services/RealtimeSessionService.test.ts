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
      emit: (key, event) => listeners.get(key)?.forEach((callback) => callback(event as never)),
    },
    canReadStory,
    getReadableStoryIds,
    logInfo,
    now: () => now,
    createId: () => 'ticket-1',
    // No real intervals by default: several tests open sockets they never close, and a 30s
    // timer per open would outlive the file. The heartbeat behavior itself is driven by hand below.
    startHeartbeat: () => () => {},
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
        emit: (key, event) => listeners.get(key)?.forEach((callback) => callback(event as never)),
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

  it('treats a missing ticket as invalid and closes a socket that opens without one', async () => {
    expect(service.hasValidTicket(undefined)).toBe(false);

    const socket = { send: vi.fn(), close: vi.fn() };
    await service.openEvents(socket, undefined);

    expect(socket.close).toHaveBeenCalledOnce();
    expect(getReadableStoryIds).not.toHaveBeenCalled();
  });

  it('ignores null and primitive messages instead of throwing on them', async () => {
    const socket = { send: vi.fn(), realtimeUserId: 'user-1' };

    await service.handleEventMessage(socket, null);
    await service.handleEventMessage(socket, 42);
    await service.handleEventMessage(socket, true);
    await service.handleEventMessage(socket, ['subscribe']);

    expect(canReadStory).not.toHaveBeenCalled();
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('closes the socket instead of leaving it half-subscribed when the story list fails', async () => {
    const ticket = service.createTicket({ userId: 'user-1', username: 'ana' });
    const socket = { send: vi.fn(), close: vi.fn() };
    getReadableStoryIds.mockRejectedValueOnce(new Error('database unreachable'));

    await expect(service.openEvents(socket, ticket)).resolves.toBeUndefined();

    expect(socket.close).toHaveBeenCalledOnce();
    expect(socket.send).not.toHaveBeenCalledWith(expect.stringContaining('server.heartbeat'));
    expect(listeners.get('userUpdate:user-1')?.size ?? 0).toBe(0);
    expect(listeners.get('storyUpdate:story-1')?.size ?? 0).toBe(0);
  });

  it('ignores subscription requests that arrive after the socket closed', async () => {
    const socket = { send: vi.fn(), realtimeUserId: 'user-1' };
    service.closeEvents(socket);
    vi.clearAllMocks();

    await service.handleEventMessage(socket, { type: 'subscribe', storyId: 'story-1' });

    expect(canReadStory).not.toHaveBeenCalled();
    expect(listeners.get('storyUpdate:story-1')).toBeUndefined();
  });

  it('ticks heartbeats while open, stops them on close, and reaps a socket it cannot send to', async () => {
    const ticks: Array<() => void> = [];
    const stops: Array<() => void> = [];
    const heartbeatService = new RealtimeSessionService({
      eventBus: {
        on: (key, callback) => {
          const callbacks = listeners.get(key) ?? new Set();
          callbacks.add(callback);
          listeners.set(key, callbacks);
        },
        off: (key, callback) => listeners.get(key)?.delete(callback),
        emit: (key, event) => listeners.get(key)?.forEach((callback) => callback(event as never)),
      },
      canReadStory,
      getReadableStoryIds,
      logInfo,
      now: () => now,
      createId: () => 'ticket-hb',
      startHeartbeat: (tick) => {
        ticks.push(tick);
        const stop = vi.fn();
        stops.push(stop);
        return stop;
      },
    });
    const ticket = heartbeatService.createTicket({ userId: 'user-1', username: 'ana' });
    const socket = { send: vi.fn(), close: vi.fn() };

    await heartbeatService.openEvents(socket, ticket);
    expect(ticks).toHaveLength(1);
    ticks[0]!();
    expect(socket.send).toHaveBeenCalledTimes(2);
    expect(socket.send).toHaveBeenLastCalledWith(expect.stringContaining('server.heartbeat'));

    heartbeatService.closeEvents(socket);
    expect(stops[0]).toHaveBeenCalledOnce();

    // A tick that cannot be sent closes the socket from the server side instead of leaving a
    // dead connection subscribed.
    const dying = { send: vi.fn(), close: vi.fn() };
    await heartbeatService.openEvents(
      dying,
      heartbeatService.createTicket({ userId: 'user-1', username: 'ana' }),
    );
    dying.send.mockImplementation(() => {
      throw new Error('send on a dead socket');
    });
    ticks[1]!();
    expect(dying.close).toHaveBeenCalledOnce();
    heartbeatService.closeEvents(dying);
  });

  it('closes sockets that never subscribed without touching the bus', () => {
    const pristine = { send: vi.fn() };
    service.closeEvents(pristine);

    expect(logInfo).not.toHaveBeenCalled();

    const identified = { send: vi.fn(), realtimeUserId: 'user-1' };
    service.closeEvents(identified);

    expect(logInfo).toHaveBeenCalledWith('User left realtime channel', { userId: 'user-1' });
    expect(listeners.get('userUpdate:user-1')).toBeUndefined();
  });
});
