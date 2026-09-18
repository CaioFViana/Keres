const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = {
  goBack: (...args: unknown[]) => mockGoBack(...args),
  navigate: (...args: unknown[]) => mockNavigate(...args),
};
const mockRoute: { params?: Record<string, unknown> } = { params: {} };
const mockFindStories = jest.fn();
const mockFindLogs = jest.fn();
const mockDrizzle = {
  query: {
    stories: { findMany: (...args: unknown[]) => mockFindStories(...args) },
    operationLogs: { findMany: (...args: unknown[]) => mockFindLogs(...args) },
  },
};
const mockGetAllServers = jest.fn();
const mockGetPubs = jest.fn();
const mockSyncPubs = jest.fn();
const mockGetShowcase = jest.fn();
const mockPublish = jest.fn();
const mockDeletePublication = jest.fn();
const mockUnpublish = jest.fn();
const mockIsOffline = jest.fn();
const mockNotify = jest.fn();
const mockSetTheme = jest.fn();
const mockConnectivity = { isOffline: (...args: unknown[]) => mockIsOffline(...args) };
const mockNotificationState = { showNotification: (...args: unknown[]) => mockNotify(...args) };
const mockColors = {
  primary: '#0000ff',
  onPrimary: '#ffffff',
  primaryContainer: '#e0e0ff',
  onPrimaryContainer: '#000088',
  secondary: '#00aa00',
  onSecondary: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  background: '#ffffff',
  surface: '#f5f5f5',
  border: '#cccccc',
  error: '#ff0000',
  onError: '#ffffff',
  accent: '#ff8800',
  onAccent: '#000000',
  notification: '#00aaff',
  onNotification: '#000000',
  shadow: '#000000',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => mockI18n,
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text>,
  };
});

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => mockNavigation,
    useRoute: () => mockRoute,
    useIsFocused: () => true,
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = callback();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: mockSetTheme, colors: mockColors }),
  };
});

jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => {},
}));

jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  useBackButtonHandler: () => {},
}));

jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 20,
}));

jest.mock('../../../src/db', () => ({
  useDrizzle: () => mockDrizzle,
}));

jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('../../../src/services/ServerService', () => ({
  createServerService: () => ({
    getAllServers: (...args: unknown[]) => mockGetAllServers(...args),
  }),
}));

jest.mock('../../../src/services/PublicationService', () => ({
  createPublicationService: () => ({
    getPublicationsForStory: (...args: unknown[]) => mockGetPubs(...args),
    syncPublicationsWithServer: (...args: unknown[]) => mockSyncPubs(...args),
  }),
}));

jest.mock('../../../src/services/PublicationApiService', () => ({
  publicationApiService: {
    getStoryShowcase: (...args: unknown[]) => mockGetShowcase(...args),
    publish: (...args: unknown[]) => mockPublish(...args),
    deletePublication: (...args: unknown[]) => mockDeletePublication(...args),
    unpublish: (...args: unknown[]) => mockUnpublish(...args),
  },
}));

jest.mock('../../../src/services/apiClient', () => ({
  __esModule: true,
  default: {},
  apiUrl: (base: string, path: string) => `${base}${path}`,
  isOfflineError: (err: unknown) => !!(err as { isOffline?: boolean } | null)?.isOffline,
}));

jest.mock('../../../src/state/connectivityStore', () => ({
  useConnectivityStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockConnectivity) : mockConnectivity,
}));

jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockNotificationState) : mockNotificationState,
}));

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import PublishStoryScreen, {
  buildStoryPublicUrl,
} from '../../../src/screens/enterstack/PublishStoryScreen';

const server = { id: 'srv-1', name: 'Main', url: 'https://s.example///' };
const story = {
  id: 'story-1',
  serverId: 'srv-1',
  title: 'Epic',
  lastOperationLog: 5,
  lastServerSyncedLog: 5,
};
const remoteUnpublished = {
  isPublished: false,
  visibility: 'public',
  labelMode: 'both',
  hasPassword: false,
  publications: [],
};

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

function alertButtons(callIndex = 0): AlertButton[] {
  return mockAlert.mock.calls[callIndex][2] as AlertButton[];
}

describe('buildStoryPublicUrl', () => {
  it('joins the server origin and story id without duplicate slashes', () => {
    expect(buildStoryPublicUrl('https://s.example///', 'story-1')).toBe(
      'https://s.example/story/story-1',
    );
    expect(buildStoryPublicUrl('https://s.example', 'story-1')).toBe(
      'https://s.example/story/story-1',
    );
  });
});

describe('PublishStoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    mockGetAllServers.mockResolvedValue([server]);
    mockFindStories.mockResolvedValue([story]);
    mockFindLogs.mockResolvedValue([]);
    mockGetPubs.mockResolvedValue([]);
    mockGetShowcase.mockResolvedValue(remoteUnpublished);
    mockPublish.mockResolvedValue({ label: 'v1' });
    mockDeletePublication.mockResolvedValue(undefined);
    mockUnpublish.mockResolvedValue(undefined);
    mockSyncPubs.mockResolvedValue(undefined);
    mockIsOffline.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('shows the empty state without eligible stories', async () => {
    mockFindStories.mockResolvedValue([]);
    const view = await render(<PublishStoryScreen />);
    await view.findByText('publish_no_eligible_stories');
    expect(view.getByText('publish_story_description')).toBeTruthy();
  });

  it('shows the error screen when loading fails', async () => {
    mockGetAllServers.mockRejectedValue(new Error('db down'));
    const view = await render(<PublishStoryScreen />);
    await view.findByText('failed_to_load_stories');
  });

  it('skips stories whose server is unknown locally', async () => {
    mockFindStories.mockResolvedValue([{ ...story, id: 'orphan', serverId: 'srv-x' }]);
    const view = await render(<PublishStoryScreen />);
    await view.findByText('publish_no_eligible_stories');
  });

  it('explains why a story cannot be published right now', async () => {
    mockIsOffline.mockReturnValue(true);
    const offline = await render(<PublishStoryScreen />);
    await offline.findByText('publish_blocked_offline');
    expect(offline.getByText('Epic')).toBeTruthy();
  });

  it('blocks publishing with pending operations or missing sync', async () => {
    mockFindLogs.mockResolvedValue([{ id: 'op-1' }]);
    const pending = await render(<PublishStoryScreen />);
    await pending.findByText('publish_blocked_pending_operations');

    mockFindLogs.mockResolvedValue([]);
    mockFindStories.mockResolvedValue([{ ...story, lastServerSyncedLog: 3 }]);
    const unsynced = await render(<PublishStoryScreen />);
    await unsynced.findByText('publish_blocked_not_synced');
  });

  it('publishes a new version and shows its public address', async () => {
    const view = await render(<PublishStoryScreen />);
    await view.findByText('Epic');
    await fireEvent.press(view.getByText('Epic'));
    await view.findByText('publish_create_version');
    await fireEvent.press(view.getByText('publish_label_style_version'));
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() =>
      expect(mockPublish).toHaveBeenCalledWith(
        server,
        'story-1',
        5,
        'version',
        'public',
        undefined,
      ),
    );
    expect(mockSyncPubs).toHaveBeenCalledWith(server);
    expect(mockAlert).toHaveBeenCalledWith(
      'publish_version_created',
      expect.stringContaining('https://s.example/story/story-1'),
      expect.any(Array),
    );
    const open = alertButtons(0).find((b) => b.text === 'publish_open_link');
    await act(async () => {
      await open?.onPress?.();
    });
    expect(Linking.openURL).toHaveBeenCalledWith('https://s.example/story/story-1');
  });

  it('requires a long enough password when the padlock is on', async () => {
    const view = await render(<PublishStoryScreen />);
    await view.findByText('Epic');
    await fireEvent.press(view.getByText('Epic'));
    await fireEvent.press(view.getByTestId('publish-password-switch-story-1'));
    await fireEvent.changeText(view.getByPlaceholderText('publish_password_placeholder'), 'abc');
    await fireEvent.press(view.getByText('publish_create_version'));
    expect(mockNotify).toHaveBeenCalledWith('publish_password_too_short', 'error');
    expect(mockPublish).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByPlaceholderText('publish_password_placeholder'), 'pw1234');
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() =>
      expect(mockPublish).toHaveBeenCalledWith(server, 'story-1', 5, 'both', 'password', 'pw1234'),
    );
  });

  it('warns before opening already protected versions', async () => {
    mockGetShowcase.mockResolvedValue({
      isPublished: true,
      visibility: 'password',
      labelMode: 'both',
      hasPassword: true,
      publications: [
        {
          id: 'p1',
          storyId: 'story-1',
          label: 'v1',
          operationVersion: 5,
          byteSize: 2048,
          createdAt: '2026-01-01',
        },
      ],
    });
    const view = await render(<PublishStoryScreen />);
    await view.findByText('Epic');
    await fireEvent.press(view.getByText('Epic'));
    await fireEvent.press(view.getByTestId('publish-password-switch-story-1'));
    expect(view.queryByPlaceholderText('publish_password_placeholder')).toBeNull();
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith(
        'publish_opening_protected_title',
        'publish_opening_protected_message',
        expect.any(Array),
      ),
    );
    expect(mockPublish).not.toHaveBeenCalled();
    const confirm = alertButtons(0).find((b) => b.text === 'publish_opening_protected_confirm');
    await act(async () => {
      await confirm?.onPress?.();
    });
    await waitFor(() => expect(mockPublish).toHaveBeenCalled());
  });

  it('maps publish failures to notifications', async () => {
    const view = await render(<PublishStoryScreen />);
    await view.findByText('Epic');
    await fireEvent.press(view.getByText('Epic'));
    await view.findByText('publish_create_version');

    mockPublish.mockRejectedValueOnce({ response: { status: 409 } });
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('publish_blocked_not_synced', 'error'),
    );

    mockPublish.mockRejectedValueOnce({ response: { status: 403 } });
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('publish_showcase_disabled', 'error'),
    );

    mockPublish.mockRejectedValueOnce({ isOffline: true });
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('publish_blocked_offline', 'error'),
    );

    mockPublish.mockRejectedValueOnce(new Error('boom'));
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('publish_failed', 'error'));
  });

  it('deletes a single version after confirmation', async () => {
    mockGetShowcase.mockResolvedValue({
      isPublished: true,
      visibility: 'public',
      labelMode: 'both',
      hasPassword: false,
      publications: [
        {
          id: 'p1',
          storyId: 'story-1',
          label: 'v1',
          operationVersion: 5,
          byteSize: 2048,
          createdAt: '2026-01-01',
        },
      ],
    });
    const view = await render(<PublishStoryScreen />);
    await view.findByText('Epic');
    await fireEvent.press(view.getByText('Epic'));
    await view.findByText('v1');
    expect(view.getByText('https://s.example/story/story-1')).toBeTruthy();
    await fireEvent.press(view.getByTestId('icon-trash-outline'));
    expect(mockAlert).toHaveBeenCalledWith(
      'publish_delete_version_title',
      'publish_delete_version_message',
      expect.any(Array),
    );
    const del = alertButtons(0).find((b) => b.text === 'delete');
    await act(async () => {
      await del?.onPress?.();
    });
    await waitFor(() =>
      expect(mockDeletePublication).toHaveBeenCalledWith(server, 'story-1', 'p1'),
    );
    expect(mockNotify).toHaveBeenCalledWith('publish_version_deleted', 'success');
  });

  it('unpublishes the story after confirmation', async () => {
    mockGetShowcase.mockResolvedValue({
      isPublished: true,
      visibility: 'public',
      labelMode: 'both',
      hasPassword: false,
      publications: [
        {
          id: 'p1',
          storyId: 'story-1',
          label: 'v1',
          operationVersion: 5,
          byteSize: 1024,
          createdAt: '2026-01-01',
        },
        {
          id: 'p2',
          storyId: 'story-1',
          label: 'v2',
          operationVersion: 6,
          byteSize: 1024,
          createdAt: '2026-01-02',
        },
      ],
    });
    const view = await render(<PublishStoryScreen />);
    await view.findByText('Epic');
    await fireEvent.press(view.getByText('Epic'));
    await view.findByText('publish_unpublish_confirm');
    expect(view.getByText('publish_visibility_applies_to_all')).toBeTruthy();
    await fireEvent.press(view.getByText('publish_open_link'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://s.example/story/story-1');
    await fireEvent.press(view.getByText('publish_unpublish_confirm'));
    const confirm = alertButtons(0).find((b) => b.text === 'publish_unpublish_confirm');
    await act(async () => {
      await confirm?.onPress?.();
    });
    await waitFor(() => expect(mockUnpublish).toHaveBeenCalledWith(server, 'story-1'));
    expect(mockNotify).toHaveBeenCalledWith('publish_unpublished', 'success');
  });

  it('keeps the local mirror when the server state cannot be read', async () => {
    mockGetShowcase.mockRejectedValue({ isOffline: true });
    const view = await render(<PublishStoryScreen />);
    await view.findByText('Epic');
    expect(view.getByText(/publish_not_published/)).toBeTruthy();
  });
});
