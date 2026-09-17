import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { JWTPayload } from '../../src/index';
import {
  assertRealtimeTicket,
  closeRealtimeEvents,
  createWebSocketTicket,
  handleRealtimeEventMessage,
  hasValidRealtimeTicket,
  openRealtimeEvents,
} from '../../src/modules/webSocket/webSocket.route';
import type { RealtimeSocket } from '../../src/services/RealtimeSessionService';
import { eventManager } from '../../src/utils/EventManager';
import { registerUser, uploadTestStory, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let storyId: string;

const fakeSocket = () =>
  ({ send: vi.fn(), close: vi.fn() }) as RealtimeSocket & { send: Mock; close: Mock };
const payload = (user: TestUser): JWTPayload => ({
  userId: user.userId,
  username: user.username,
});

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token)).id;
});

describe('realtime ticket gate', () => {
  it('accepts a fresh ticket and refuses a bogus or missing one', () => {
    const ticket = createWebSocketTicket(payload(ana));

    expect(hasValidRealtimeTicket(ticket)).toBe(true);
    expect(() => assertRealtimeTicket(ticket)).not.toThrow();
    expect(hasValidRealtimeTicket('bogus')).toBe(false);
    expect(hasValidRealtimeTicket(undefined)).toBe(false);
  });

  it('refuses with 401 rather than a generic failure', () => {
    const failure = (() => {
      try {
        assertRealtimeTicket(undefined);
      } catch (error) {
        return error as { status?: number; message?: string };
      }
      return null;
    })();

    expect(failure?.status).toBe(401);
    expect(failure?.message).toBe('Unauthorized WebSocket ticket.');
  });
});

describe('realtime sessions over a real database', () => {
  it('opens with the owned stories subscribed and delivers their events', async () => {
    const socket = fakeSocket();
    try {
      await openRealtimeEvents(socket, createWebSocketTicket(payload(ana)));

      expect(socket.storyCallbacks?.has(storyId)).toBe(true);
      expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('server.heartbeat'));

      eventManager.emit(`storyUpdate:${storyId}`, { maxOperationVersion: 7 });
      expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('"type":"story.changed"'));
    } finally {
      closeRealtimeEvents(socket);
    }
  });

  it('opens a stranger with no story subscriptions', async () => {
    const bia = await registerUser('bia');
    const socket = fakeSocket();
    try {
      await openRealtimeEvents(socket, createWebSocketTicket(payload(bia)));

      expect(socket.storyCallbacks?.size ?? 0).toBe(0);
      expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('server.heartbeat'));
    } finally {
      closeRealtimeEvents(socket);
    }
  });

  it('lets a message subscribe only to readable stories', async () => {
    const bia = await registerUser('bia');
    const socket = fakeSocket();
    try {
      await openRealtimeEvents(socket, createWebSocketTicket(payload(bia)));
      await handleRealtimeEventMessage(socket, JSON.stringify({ type: 'subscribe', storyId }));

      expect(socket.storyCallbacks?.has(storyId)).toBe(false);
      eventManager.emit(`storyUpdate:${storyId}`, { maxOperationVersion: 7 });
      expect(socket.send).not.toHaveBeenCalledWith(expect.stringContaining('story.changed'));
    } finally {
      closeRealtimeEvents(socket);
    }
  });

  it('re-subscribes an already-subscribed story without duplicating delivery', async () => {
    const socket = fakeSocket();
    try {
      await openRealtimeEvents(socket, createWebSocketTicket(payload(ana)));
      await handleRealtimeEventMessage(socket, JSON.stringify({ type: 'subscribe', storyId }));

      socket.send.mockClear();
      eventManager.emit(`storyUpdate:${storyId}`, { maxOperationVersion: 7 });
      const deliveries = socket.send.mock.calls.filter(([message]: Array<unknown>) =>
        String(message).includes('story.changed'),
      );

      expect(deliveries).toHaveLength(1);
    } finally {
      closeRealtimeEvents(socket);
    }
  });

  it('closes a socket that opens without a valid ticket', async () => {
    const socket = fakeSocket();

    await openRealtimeEvents(socket, 'bogus');

    expect(socket.close).toHaveBeenCalledOnce();
    expect(socket.storyCallbacks).toBeUndefined();
  });

  it('stops delivering story events after close', async () => {
    const socket = fakeSocket();
    await openRealtimeEvents(socket, createWebSocketTicket(payload(ana)));
    closeRealtimeEvents(socket);

    socket.send.mockClear();
    eventManager.emit(`storyUpdate:${storyId}`, { maxOperationVersion: 7 });

    expect(socket.send).not.toHaveBeenCalled();
  });
});
