import { act, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import SyncInitializer from '../../src/components/features/app/SyncInitializer';

// A stable `t` like the real i18next one: a fresh closure per render would change the
// reconciler's identity and fire effects the production app never refires.
const mockTranslate = (key: string) => key;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockTranslate }),
}));

const mockDrizzle = {};
jest.mock('../../src/db', () => ({ useDrizzle: () => mockDrizzle }));

const mockApiClient = {
  setTokenProvider: jest.fn(),
  setActiveServer: jest.fn(),
  setBaseUrl: jest.fn(),
};
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  // Mock factories run before this module's consts initialize: every mock value must be read
  // lazily (a getter/closure), never captured into the factory's return value.
  get default() {
    return mockApiClient;
  },
  isOfflineError: (error: { isOffline?: boolean }) => error?.isOffline === true,
}));

const mockAuthTokenManager = { name: 'auth-token-manager' };
const mockSetAuthDb = jest.fn();
jest.mock('../../src/services/AuthTokenManager', () => ({
  get authTokenManager() {
    return mockAuthTokenManager;
  },
  setAuthDb: (...args: unknown[]) => mockSetAuthDb(...args),
}));

const mockSyncFriendships = jest.fn(async () => {});
jest.mock('../../src/services/FriendshipService', () => ({
  createFriendshipService: () => ({ syncFriendshipsWithServer: mockSyncFriendships }),
}));

const mockGetAllServers = jest.fn(async () => [] as unknown[]);
const mockRefreshToken = jest.fn(async (server: unknown) => server);
const mockGetServerById = jest.fn(async (_id: string) => null as unknown);
jest.mock('../../src/services/ServerService', () => ({
  createServerService: () => ({
    getAllServers: mockGetAllServers,
    refreshServerToken: mockRefreshToken,
    getServerById: mockGetServerById,
  }),
}));

const mockRtStart = jest.fn();
const mockRtStop = jest.fn(async () => {});
const mockRtSubscribe = jest.fn();
const mockRealtimeClass = jest.fn(() => ({
  start: mockRtStart,
  stop: mockRtStop,
  subscribeToStory: mockRtSubscribe,
}));
jest.mock('../../src/services/ServerRealtimeService', () => ({
  get ServerRealtimeService() {
    return mockRealtimeClass;
  },
}));

const mockGetAllStories = jest.fn(async () => [] as unknown[]);
jest.mock('../../src/services/storymanagement/StoryService', () => ({
  createStoryService: () => ({ getAllStories: mockGetAllStories }),
}));

const mockSyncEngine = {
  bindDatabase: jest.fn(async () => {}),
  fetchServerStoryPreviews: jest.fn(async () => [] as unknown[]),
  downloadAndImportStory: jest.fn(async () => {}),
  requestSync: jest.fn(),
  deactivateStory: jest.fn(async () => {}),
  activateStory: jest.fn(async () => {}),
  startSync: jest.fn(),
};
jest.mock('../../src/services/sync/appSyncEngine', () => ({
  get syncEngine() {
    return mockSyncEngine;
  },
}));

const mockShowNotification = jest.fn();
jest.mock('../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) => {
    const state = { showNotification: mockShowNotification };
    return selector ? selector(state) : state;
  },
}));

const mockFetchStories = jest.fn();
jest.mock('../../src/state/storyListStore', () => ({
  useStoryListStore: (selector?: (state: unknown) => unknown) => {
    const state = { fetchStories: mockFetchStories };
    return selector ? selector(state) : state;
  },
}));

const mockStoryState: {
  current: { selectedStory: { id: string; serverId: string | null } | null };
} = { current: { selectedStory: null } };
jest.mock('../../src/state/storyStore', () => ({
  useStoryStore: (selector?: (state: unknown) => unknown) =>
    selector ? selector(mockStoryState.current) : mockStoryState.current,
}));

const mockRefreshConflicts = jest.fn(async () => {});
jest.mock('../../src/state/syncConflictStore', () => ({
  useSyncConflictStore: { getState: () => ({ refresh: mockRefreshConflicts }) },
}));

const mockUserSettings: {
  current: {
    userId: string | null;
    activeServer: null;
    clearActiveServer: jest.Mock;
    setActiveServer: jest.Mock;
  };
} = {
  current: {
    userId: 'user-1',
    activeServer: null,
    clearActiveServer: jest.fn(),
    setActiveServer: jest.fn(),
  },
};
jest.mock('../../src/state/userSettingsStore', () => {
  const hook = (selector?: (state: unknown) => unknown) =>
    selector ? selector(mockUserSettings.current) : mockUserSettings.current;
  return {
    useUserSettingsStore: Object.assign(hook, { getState: () => mockUserSettings.current }),
  };
});

const mockEEOn = jest.fn();
const mockEEOff = jest.fn();
jest.mock('../../src/utils/EventEmitter', () => ({
  entityEventEmitter: {
    on: (...args: unknown[]) => mockEEOn(...args),
    off: (...args: unknown[]) => mockEEOff(...args),
  },
}));

const mockInitialLoad = jest.fn();
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => ({
  useEntityInitialLoad: (...args: unknown[]) => mockInitialLoad(...args),
}));

const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const handlerFor = (event: string) => {
  const call = mockEEOn.mock.calls.find((args: unknown[]) => args[0] === event);
  if (!call) throw new Error(`no subscription for "${event}"`);
  return call[1] as (...args: never[]) => void;
};

const offlineError = () => Object.assign(new Error('net down'), { isOffline: true });

const server = { id: 'srv-1', idUser: 'user-1', name: 'Home', url: 'https://home.example' };

beforeEach(() => {
  jest.clearAllMocks();
  mockUserSettings.current = {
    userId: 'user-1',
    activeServer: null,
    clearActiveServer: jest.fn(),
    setActiveServer: jest.fn(),
  };
  mockStoryState.current = { selectedStory: null };
  mockGetAllServers.mockResolvedValue([]);
  mockGetAllStories.mockResolvedValue([]);
  mockSyncEngine.fetchServerStoryPreviews.mockResolvedValue([]);
  mockRefreshToken.mockImplementation(async (value: unknown) => value);
  mockGetServerById.mockResolvedValue(null);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SyncInitializer', () => {
  it('renders its children and wires the token provider', async () => {
    const view = await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();

    expect(view.getByText('app')).toBeTruthy();
    expect(mockApiClient.setTokenProvider).toHaveBeenCalledWith(mockAuthTokenManager);
    expect(mockEEOn).toHaveBeenCalledWith('application_resetting', expect.any(Function));
    expect(mockEEOn).toHaveBeenCalledWith('server_connection_changed', expect.any(Function));
    expect(mockEEOn).toHaveBeenCalledWith('operation_log_updated', expect.any(Function));
    expect(mockEEOn).toHaveBeenCalledWith('sync_conflicts_changed', expect.any(Function));
    expect(mockInitialLoad).toHaveBeenCalledWith(expect.any(Function));
  });

  it('skips reconciliation without a signed-in user', async () => {
    mockUserSettings.current.userId = null;
    await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();

    expect(mockSyncEngine.bindDatabase).not.toHaveBeenCalled();
    expect(mockRealtimeClass).not.toHaveBeenCalled();
  });

  it('binds the database and skips servers without a URL', async () => {
    mockGetAllServers.mockResolvedValue([{ ...server, url: null }]);
    await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();

    expect(mockSyncEngine.bindDatabase).toHaveBeenCalledWith(mockDrizzle);
    expect(mockSetAuthDb).toHaveBeenCalledWith(mockDrizzle);
    expect(mockApiClient.setActiveServer).not.toHaveBeenCalled();
    expect(mockRealtimeClass).toHaveBeenCalledTimes(1);
    expect(mockRtStart).toHaveBeenCalledWith(undefined);
  });

  it('imports stories missing locally and refreshes the list', async () => {
    mockGetAllServers.mockResolvedValue([server]);
    mockGetAllStories.mockResolvedValue([{ id: 'local-1' }]);
    mockSyncEngine.fetchServerStoryPreviews.mockResolvedValue([
      { storyId: 'local-1', lastOperationVersion: 1, role: 'owner' },
      { storyId: 'new-1', lastOperationVersion: 4, role: 'owner' },
    ]);
    await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();

    expect(mockApiClient.setActiveServer).toHaveBeenCalledWith(server);
    expect(mockApiClient.setBaseUrl).toHaveBeenCalledWith(server.url);
    expect(mockRefreshToken).toHaveBeenCalledWith(server);
    expect(mockSyncFriendships).toHaveBeenCalledWith('user-1', server);
    expect(mockSyncEngine.downloadAndImportStory).toHaveBeenCalledTimes(1);
    expect(mockSyncEngine.downloadAndImportStory).toHaveBeenCalledWith(
      'srv-1',
      'new-1',
      'user-1',
      'owner',
    );
    expect(mockFetchStories).toHaveBeenCalledTimes(1);
  });

  it('retries unreachable servers silently but reports real failures', async () => {
    mockGetAllServers.mockResolvedValue([server]);
    mockSyncEngine.fetchServerStoryPreviews.mockRejectedValueOnce(offlineError());
    await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();
    expect(mockShowNotification).not.toHaveBeenCalled();

    mockSyncEngine.fetchServerStoryPreviews.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      handlerFor('server_connection_changed')();
    });
    await flush();
    expect(mockShowNotification).toHaveBeenCalledWith('failed_to_sync_with_server: Home', 'error');
  });

  it('reports stories that fail to download', async () => {
    mockGetAllServers.mockResolvedValue([server]);
    mockSyncEngine.fetchServerStoryPreviews.mockResolvedValue([
      { storyId: 'new-1', lastOperationVersion: 4, role: 'owner' },
    ]);
    mockSyncEngine.downloadAndImportStory.mockRejectedValueOnce(new Error('corrupt'));
    await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();

    expect(mockShowNotification).toHaveBeenCalledWith('failed_to_download_story: new-1', 'error');
  });

  it('activates sync for a server-linked story', async () => {
    mockStoryState.current = { selectedStory: { id: 'story-1', serverId: 'srv-1' } };
    mockGetAllServers.mockResolvedValue([server]);
    mockGetServerById.mockResolvedValue(server);
    await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();
    await flush();

    expect(mockSyncEngine.activateStory).toHaveBeenCalledWith('story-1', server);
    expect(mockSyncEngine.requestSync).toHaveBeenCalledWith('initial');
    expect(mockSyncEngine.startSync).toHaveBeenCalledTimes(1);
    expect(mockUserSettings.current.setActiveServer).toHaveBeenCalledWith(server);
    expect(mockRtStart).toHaveBeenCalledWith('story-1');
    expect(mockRtSubscribe).toHaveBeenCalledWith('story-1');
  });

  it('stops sync when the story leaves its server', async () => {
    mockStoryState.current = { selectedStory: { id: 'story-1', serverId: null } };
    await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();

    expect(mockSyncEngine.deactivateStory).toHaveBeenCalled();
    expect(mockUserSettings.current.clearActiveServer).toHaveBeenCalled();
    expect(mockSyncEngine.activateStory).not.toHaveBeenCalled();
  });

  it('stops sync when the linked server is gone and reports lookup failures', async () => {
    mockStoryState.current = { selectedStory: { id: 'story-1', serverId: 'srv-1' } };
    mockGetServerById.mockResolvedValue(null);
    const view = await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();

    expect(mockSyncEngine.deactivateStory).toHaveBeenCalled();
    expect(mockShowNotification).not.toHaveBeenCalled();

    // Opening another linked story reruns the lookup, which now fails.
    mockStoryState.current = { selectedStory: { id: 'story-2', serverId: 'srv-1' } };
    mockGetServerById.mockRejectedValueOnce(new Error('db down'));
    await view.rerender(
      <SyncInitializer>
        <Text>app again</Text>
      </SyncInitializer>,
    );
    await flush();
    expect(mockShowNotification).toHaveBeenCalledWith(
      'failed_to_sync_with_server: story-2',
      'error',
    );
  });

  it('pushes local changes only for the open story', async () => {
    mockStoryState.current = { selectedStory: { id: 'story-1', serverId: null } };
    await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();

    mockSyncEngine.requestSync.mockClear();
    await act(async () => {
      handlerFor('operation_log_updated')('other-story' as never);
    });
    expect(mockSyncEngine.requestSync).not.toHaveBeenCalled();

    await act(async () => {
      handlerFor('operation_log_updated')('story-1' as never);
    });
    expect(mockSyncEngine.requestSync).toHaveBeenCalledWith('local-change');
  });

  it('reconciles again when the server registry changes', async () => {
    await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();
    expect(mockSyncEngine.bindDatabase).toHaveBeenCalledTimes(1);

    await act(async () => {
      handlerFor('server_connection_changed')();
    });
    await flush();
    expect(mockSyncEngine.bindDatabase).toHaveBeenCalledTimes(2);
  });

  it('tears everything down on unmount', async () => {
    mockGetAllServers.mockResolvedValue([server]);
    const view = await render(
      <SyncInitializer>
        <Text>app</Text>
      </SyncInitializer>,
    );
    await flush();

    mockSyncEngine.deactivateStory.mockClear();
    mockUserSettings.current.clearActiveServer.mockClear();
    await act(async () => {
      view.unmount();
    });

    for (const event of [
      'application_resetting',
      'server_connection_changed',
      'operation_log_updated',
      'sync_conflicts_changed',
    ]) {
      expect(mockEEOff).toHaveBeenCalledWith(event, expect.any(Function));
    }
    expect(mockRtStop).toHaveBeenCalled();
    expect(mockSyncEngine.deactivateStory).toHaveBeenCalled();
    expect(mockUserSettings.current.clearActiveServer).toHaveBeenCalled();
  });
});
