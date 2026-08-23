/**
 * @jest-environment node
 */
jest.mock('../../src/services/apiClient', () => ({ createKeresAxiosInstance: jest.fn() }));
jest.mock('../../src/services/AuthTokenManager', () => ({ authTokenManager: {} }));
jest.mock('../../src/services/FriendshipService', () => ({ createFriendshipService: jest.fn() }));
jest.mock('../../src/services/SyncEngineService', () => ({
  SyncEngineService: { getInstance: jest.fn() },
}));
jest.mock('../../src/services/storymanagement/StoryService', () => ({
  createStoryService: jest.fn(),
}));
jest.mock('../../src/state/storyListStore', () => ({
  useStoryListStore: { getState: jest.fn() },
}));

import { createKeresAxiosInstance } from '../../src/services/apiClient';
import { createFriendshipService } from '../../src/services/FriendshipService';
import { ServerRealtimeService } from '../../src/services/ServerRealtimeService';
import { SyncEngineService } from '../../src/services/SyncEngineService';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { useStoryListStore } from '../../src/state/storyListStore';

const mockClient = {
  post: jest.fn(),
  setActiveServer: jest.fn(),
  setTokenProvider: jest.fn(),
};
const mockFriendshipService = { syncFriendshipsWithServer: jest.fn() };
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
  (SyncEngineService.getInstance as jest.Mock).mockReturnValue(mockSyncEngine);
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
  const service = new ServerRealtimeService({} as any, server, 'me');
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
  // O eventManager do servidor é em memória, não uma fila durável - qualquer evento emitido
  // enquanto este cliente estava desconectado nunca é reentregue. Sem isto, a história só
  // sincronizava de novo na próxima edição local.
  const service = new ServerRealtimeService({} as any, server, 'me');
  service.start('story');
  await flush();

  const socket = MockWebSocket.instances[0];
  socket.onopen?.();

  expect(mockSyncEngine.requestSync).toHaveBeenCalledWith('websocket');
  await service.stop();
});

it('does not request a sync on connect when not subscribed to any story yet', async () => {
  const service = new ServerRealtimeService({} as any, server, 'me');
  service.start(); // no storyId
  await flush();

  const socket = MockWebSocket.instances[0];
  socket.onopen?.();

  expect(mockSyncEngine.requestSync).not.toHaveBeenCalled();
  await service.stop();
});

/**
 * Regressão: uma história nova (ex.: alguém te adicionou como colaborador) chegava por este
 * evento, era baixada e salva no banco local, mas `StorySelectionScreen` continuava mostrando a
 * lista antiga - nada avisava `useStoryListStore` que havia algo novo pra buscar.
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
      { storyId: 'existing', role: 'owner' },
      { storyId: 'new-story', role: 'reader' },
    ]);

    const service = new ServerRealtimeService(mockDb as any, server, 'me');
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
      { storyId: 'existing', role: 'owner' },
    ]);

    const service = new ServerRealtimeService(mockDb as any, server, 'me');
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
