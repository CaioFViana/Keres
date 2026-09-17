/**
 * @jest-environment node
 */
jest.mock('../../src/services/apiClient', () => ({
  createKeresAxiosInstance: jest.fn(),
  apiBaseUrl: (serverUrl: string) => `${serverUrl.replace(/\/+$/, '')}/api`,
  apiUrl: (serverUrl: string, endpoint: string) =>
    `${serverUrl.replace(/\/+$/, '')}/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`,
}));
jest.mock('../../src/services/AuthTokenManager', () => ({ authTokenManager: {} }));
jest.mock('../../src/services/FriendshipService', () => ({ createFriendshipService: jest.fn() }));
jest.mock('../../src/services/PublicationService', () => ({ createPublicationService: jest.fn() }));
jest.mock('../../src/services/storymanagement/StoryService', () => ({
  createStoryService: jest.fn(),
}));
jest.mock('../../src/state/storyListStore', () => ({
  useStoryListStore: { getState: jest.fn() },
}));

import { createKeresAxiosInstance } from '../../src/services/apiClient';
import { createFriendshipService } from '../../src/services/FriendshipService';
import { createPublicationService } from '../../src/services/PublicationService';
import { ServerRealtimeService } from '../../src/services/ServerRealtimeService';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { useStoryListStore } from '../../src/state/storyListStore';

const mockClient = {
  post: jest.fn(),
  setActiveServer: jest.fn(),
  setTokenProvider: jest.fn(),
};
const mockFriendshipService = { syncFriendshipsWithServer: jest.fn() };
const mockPublicationService = { syncPublicationsWithServer: jest.fn() };
const mockSyncEngine = {
  requestSync: jest.fn(),
  fetchServerStoryPreviews: jest.fn(),
  downloadAndImportStory: jest.fn(),
};
const mockStoryService = {};
const mockFetchStories = jest.fn();

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];

  readonly readyState = MockWebSocket.OPEN;
  readonly send = jest.fn();
  readonly close = jest.fn();
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }
}

const server = { id: 'server', idUser: 'me', name: 'Casa', url: 'https://server.test' } as any;

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  MockWebSocket.instances = [];
  (globalThis as any).WebSocket = MockWebSocket;
  (createKeresAxiosInstance as jest.Mock).mockReturnValue(mockClient);
  mockClient.post.mockResolvedValue({ data: { ticket: 'ticket with space' } });
  mockFriendshipService.syncFriendshipsWithServer.mockResolvedValue(undefined);
  (createFriendshipService as jest.Mock).mockReturnValue(mockFriendshipService);
  mockPublicationService.syncPublicationsWithServer.mockResolvedValue(undefined);
  (createPublicationService as jest.Mock).mockReturnValue(mockPublicationService);
  mockSyncEngine.fetchServerStoryPreviews.mockResolvedValue([]);
  mockSyncEngine.downloadAndImportStory.mockResolvedValue(undefined);
  (createStoryService as jest.Mock).mockReturnValue(mockStoryService);
  mockFetchStories.mockResolvedValue(undefined);
  (useStoryListStore.getState as jest.Mock).mockReturnValue({ fetchStories: mockFetchStories });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('subscribes after connecting and requests a sync for a changed story notification', async () => {
  const service = new ServerRealtimeService({} as any, server, 'me', mockSyncEngine);
  service.start('story');
  await flush();

  const socket = MockWebSocket.instances[0];
  expect(socket.url).toBe('wss://server.test/api/ws/events?ticket=ticket%20with%20space');
  socket.onopen?.();
  expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'subscribe', storyId: 'story' }));
  expect(mockFriendshipService.syncFriendshipsWithServer).toHaveBeenCalledWith('me', server);

  mockSyncEngine.requestSync.mockClear(); // drop the connect-time catch-up call, tested on its own below
  socket.onmessage?.({ data: JSON.stringify({ type: 'story.changed', storyId: 'story' }) });
  await flush();
  expect(mockSyncEngine.requestSync).toHaveBeenCalledWith('websocket');

  await service.stop();
  expect(socket.close).toHaveBeenCalled();
});

it('requests a catch-up sync on every (re)connect, so events missed while offline are not lost', async () => {
  // The server's eventManager is in memory, not a durable queue - any event emitted while this client was
  // disconnected is never redelivered. Without this, the story only synchronized again on the next local
  // edit.
  const service = new ServerRealtimeService({} as any, server, 'me', mockSyncEngine);
  service.start('story');
  await flush();

  const socket = MockWebSocket.instances[0];
  socket.onopen?.();

  expect(mockSyncEngine.requestSync).toHaveBeenCalledWith('websocket');
  await service.stop();
});

it('does not request a sync on connect when not subscribed to any story yet', async () => {
  const service = new ServerRealtimeService({} as any, server, 'me', mockSyncEngine);
  service.start(); // no storyId
  await flush();

  const socket = MockWebSocket.instances[0];
  socket.onopen?.();

  expect(mockSyncEngine.requestSync).not.toHaveBeenCalled();
  await service.stop();
});

/**
 * Regression: a new story (somebody adding you as a collaborator, say) arrived through this event, was
 * downloaded and saved in the local database, but `StorySelectionScreen` carried on showing the old
 * list - nothing told `useStoryListStore` there was something new to fetch.
 */
describe('stories.catalog-changed', () => {
  it('downloads only the stories missing locally, then refreshes the story list store', async () => {
    const mockDb = {
      query: {
        stories: {
          findMany: jest.fn().mockResolvedValue([{ id: 'existing' }]),
        },
      },
    };
    mockSyncEngine.fetchServerStoryPreviews.mockResolvedValue([
      { storyId: 'existing', role: 'owner', lastOperationVersion: 0 },
      { storyId: 'new-story', role: 'reader', lastOperationVersion: 0 },
    ]);

    const service = new ServerRealtimeService(mockDb as any, server, 'me', mockSyncEngine);
    service.start('existing');
    await flush();

    const socket = MockWebSocket.instances[0];
    socket.onmessage?.({ data: JSON.stringify({ type: 'stories.catalog-changed' }) });
    await flush();

    expect(mockSyncEngine.downloadAndImportStory).toHaveBeenCalledTimes(1);
    expect(mockSyncEngine.downloadAndImportStory).toHaveBeenCalledWith(
      'server',
      'new-story',
      'me',
      'reader',
    );
    expect(mockFetchStories).toHaveBeenCalledWith(mockStoryService);

    await service.stop();
  });

  it('does not refresh the story list when there is nothing new to download', async () => {
    const mockDb = {
      query: {
        stories: {
          findMany: jest.fn().mockResolvedValue([{ id: 'existing' }]),
        },
      },
    };
    mockSyncEngine.fetchServerStoryPreviews.mockResolvedValue([
      { storyId: 'existing', role: 'owner', lastOperationVersion: 0 },
    ]);

    const service = new ServerRealtimeService(mockDb as any, server, 'me', mockSyncEngine);
    service.start('existing');
    await flush();

    const socket = MockWebSocket.instances[0];
    socket.onmessage?.({ data: JSON.stringify({ type: 'stories.catalog-changed' }) });
    await flush();

    expect(mockSyncEngine.downloadAndImportStory).not.toHaveBeenCalled();
    expect(mockFetchStories).not.toHaveBeenCalled();

    await service.stop();
  });
});

describe('subscriptions, failures and reconnects', () => {
  it('forwards a story subscription to the open socket only', async () => {
    const service = new ServerRealtimeService({} as any, server, 'me', mockSyncEngine);
    service.start();
    await flush();

    const socket = MockWebSocket.instances[0];
    socket.onopen?.();
    service.subscribeToStory('story');
    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'subscribe', storyId: 'story' }),
    );

    // A closed socket cannot take the message: the next connect subscribes instead.
    Object.defineProperty(socket, 'readyState', { value: 3 });
    service.subscribeToStory('other');
    expect(socket.send).toHaveBeenCalledTimes(1);

    await service.stop();
  });

  it('refreshes friendships and publications on their events, and ignores garbage', async () => {
    const service = new ServerRealtimeService({} as any, server, 'me', mockSyncEngine);
    service.start();
    await flush();

    const socket = MockWebSocket.instances[0];
    socket.onmessage?.({ data: JSON.stringify({ type: 'friendships.changed' }) });
    socket.onmessage?.({ data: JSON.stringify({ type: 'story.published', storyId: 'story' }) });
    socket.onmessage?.({ data: 'not-json{{{' });
    await flush();

    expect(mockFriendshipService.syncFriendshipsWithServer).toHaveBeenCalledWith('me', server);
    expect(mockPublicationService.syncPublicationsWithServer).toHaveBeenCalledWith(server);
    expect(mockSyncEngine.requestSync).not.toHaveBeenCalled();

    await service.stop();
  });

  it('logs refresh and event failures instead of crashing the connection', async () => {
    mockFriendshipService.syncFriendshipsWithServer.mockRejectedValueOnce(new Error('db locked'));
    mockPublicationService.syncPublicationsWithServer.mockRejectedValue(new Error('db locked'));
    const service = new ServerRealtimeService({} as any, server, 'me', mockSyncEngine);
    service.start();
    await flush();

    const socket = MockWebSocket.instances[0];
    socket.onopen?.();
    await flush();
    expect(console.log).toHaveBeenCalledWith('Realtime friendship refresh failed:', 'db locked');

    socket.onmessage?.({ data: JSON.stringify({ type: 'story.published', storyId: 'story' }) });
    await flush();
    expect(console.log).toHaveBeenCalledWith('Realtime event handling failed:', 'db locked');

    await service.stop();
  });

  it('closes a socket that opens after the service stopped', async () => {
    const service = new ServerRealtimeService({} as any, server, 'me', mockSyncEngine);
    service.start('story');
    await flush();
    await service.stop();

    const socket = MockWebSocket.instances[0];
    socket.onopen?.();

    expect(socket.close).toHaveBeenCalled();
    expect(socket.send).not.toHaveBeenCalled();
  });

  it('reconnects after a failure, once the health check answers', async () => {
    jest.useFakeTimers();
    const realFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue({});
    try {
      mockClient.post.mockRejectedValueOnce(new Error('no ticket'));
      const service = new ServerRealtimeService({} as any, server, 'me', mockSyncEngine);
      service.start('story');
      // `flush` uses a faked `setImmediate` under fake timers; advancing zero time only drains
      // the microtask queue the failed connect settles on.
      await jest.advanceTimersByTimeAsync(0);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Realtime connection failed'),
        'no ticket',
      );

      // The health check fails first, then answers: either way the client retries the ticket.
      mockClient.post.mockResolvedValue({ data: { ticket: 'retry-ticket' } });
      await jest.advanceTimersByTimeAsync(5_000);

      expect(globalThis.fetch).toHaveBeenCalledWith('https://server.test/api/kerescheck');
      // The failed first attempt opened nothing; the retry opened exactly one socket.
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0]?.url).toContain('ticket=retry-ticket');
      await service.stop();
    } finally {
      globalThis.fetch = realFetch;
      jest.useRealTimers();
    }
  });

  it('does not reconnect after the service stopped', async () => {
    jest.useFakeTimers();
    const realFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({});
    try {
      mockClient.post.mockRejectedValueOnce(new Error('no ticket'));
      const service = new ServerRealtimeService({} as any, server, 'me', mockSyncEngine);
      service.start('story');
      await jest.advanceTimersByTimeAsync(0);
      await service.stop();

      await jest.advanceTimersByTimeAsync(30_000);

      expect(MockWebSocket.instances).toHaveLength(0);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = realFetch;
      jest.useRealTimers();
    }
  });
});
