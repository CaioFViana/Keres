const mockNavigateAcross = jest.fn();
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
    stories: { findFirst: (...args: unknown[]) => mockFindStories(...args) },
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
const mockGetChapters = jest.fn();
const mockGetScenes = jest.fn();
const mockGetArcs = jest.fn();
const mockFetchPreviews = jest.fn();
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
      }, [callback]);
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

const mockCompact: { current: boolean } = { current: true };
jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isCompact: mockCompact.current }),
}));

jest.mock('../../../src/hooks/useNavigateAcrossStacks', () => ({
  useNavigateAcrossStacks:
    () =>
    (...args: unknown[]) =>
      mockNavigateAcross(...args),
}));

jest.mock('../../../src/state/storyStore', () => ({
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedStory: { id: 'story-1', title: 'Epic' } }),
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => {},
}));

const mockBackHandlerOptions = jest.fn();
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  useBackButtonHandler: (options: unknown) => mockBackHandlerOptions(options),
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
  SERVER_MANUSCRIPT_FORMATS: ['docx', 'pdf', 'epub', 'html', 'md', 'txt'],
}));

jest.mock('../../../src/services/storymanagement/ChapterService', () => ({
  createChapterService: () => ({
    getAllByStoryId: (...args: unknown[]) => mockGetChapters(...args),
  }),
}));

jest.mock('../../../src/services/storymanagement/SceneService', () => ({
  createSceneService: () => ({
    getAllByStoryId: (...args: unknown[]) => mockGetScenes(...args),
  }),
}));

jest.mock('../../../src/services/sync/StoryTransfer', () => ({
  fetchServerStoryPreviews: (...args: unknown[]) => mockFetchPreviews(...args),
}));

jest.mock('../../../src/services/storymanagement/StoryArcService', () => ({
  createStoryArcService: () => ({
    getArcsForStory: (...args: unknown[]) => mockGetArcs(...args),
  }),
}));

jest.mock('../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    SingleSelectPill: (props: {
      options: { label: string; value: string }[];
      value: string | null;
      onValueChange: (value: string | null) => void;
      placeholder?: string;
    }) => (
      <>
        <Text testID="route-picker-value">{props.value ?? props.placeholder}</Text>
        {props.options.map((option) => (
          <Text
            key={option.value}
            testID={`route-option-${option.value}`}
            onPress={() => props.onValueChange(option.value)}
          >
            {option.label}
          </Text>
        ))}
      </>
    ),
  };
});

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

const mockRefreshSnapshots = jest.fn();
jest.mock('../../../src/services/storymanagement/ManuscriptPagesService', () => ({
  refreshStaleSketchSnapshots: (...args: unknown[]) => mockRefreshSnapshots(...args),
}));
let mockSungSongs = false;
jest.mock('../../../src/services/storymanagement/ManuscriptMusicService', () => ({
  storyMusicFacts: async () => ({ hasMusic: mockSungSongs, hasSungSongs: mockSungSongs }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector({ userId: 'user-1' }) : { userId: 'user-1' },
}));

jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockNotificationState) : mockNotificationState,
}));

const mockSetClipboard = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetClipboard(...args),
}));

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking, StyleSheet } from 'react-native';
import StoryPublishScreen from '../../../src/screens/storyshare/StoryPublishScreen';
import { buildStoryPublicUrl } from '../../../src/screens/storyshare/useStoryPublishing';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const server = { id: 'srv-1', name: 'Main', url: 'https://s.example///' };
const story = {
  id: 'story-1',
  serverId: 'srv-1',
  title: 'Epic',
  type: 'linear',
  lastOperationLog: 5,
  lastServerSyncedLog: 5,
  myRole: 'owner',
};
const manuscriptLabels = {
  goToPage: 'export_manuscript_go_to_page',
  goToScene: 'export_manuscript_go_to_scene',
  looseHeading: 'export_manuscript_loose_heading',
  tocHeading: 'export_manuscript_index_heading',
  endOfExcerpt: 'export_manuscript_end_of_excerpt',
  chooseStart: 'export_manuscript_choose_start',
  beginAt: 'export_manuscript_begin_at',
  pageLabel: 'export_manuscript_page_label',
  frameLabel: 'export_manuscript_frame_label',
  mediaRemoved: 'export_manuscript_media_removed',
  musicLabel: 'export_manuscript_music_label',
  songsHeading: 'export_manuscript_songs_heading',
};
/** The device export's defaults, as the publish screen sends them. */
function manuscriptPayload(overrides: Record<string, unknown> = {}) {
  return {
    format: 'docx',
    includeLooseScenes: false,
    includeSceneNames: false,
    includeToc: false,
    resetSceneNumbers: false,
    style: { placeholders: { year: expect.any(String), date: expect.any(String) } },
    labels: manuscriptLabels,
    language: 'en',
    ...overrides,
  };
}
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
      'https://s.example/showcase/story/story-1',
    );
    expect(buildStoryPublicUrl('https://s.example', 'story-1')).toBe(
      'https://s.example/showcase/story/story-1',
    );
  });
});

describe('StoryPublishScreen', () => {
  beforeEach(() => {
    mockCompact.current = true;
    jest.clearAllMocks();
    mockRefreshSnapshots.mockResolvedValue(0);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    mockGetAllServers.mockResolvedValue([server]);
    mockFindStories.mockResolvedValue(story);
    mockFindLogs.mockResolvedValue([]);
    mockGetPubs.mockResolvedValue([]);
    mockGetShowcase.mockResolvedValue(remoteUnpublished);
    mockPublish.mockResolvedValue({ label: 'v1' });
    mockDeletePublication.mockResolvedValue(undefined);
    mockUnpublish.mockResolvedValue(undefined);
    mockSyncPubs.mockResolvedValue(undefined);
    mockIsOffline.mockReturnValue(false);
    mockGetChapters.mockResolvedValue([]);
    mockGetScenes.mockResolvedValue([]);
    mockGetArcs.mockResolvedValue([]);
    mockFetchPreviews.mockResolvedValue([{ storyId: 'story-1', lastOperationVersion: 5 }]);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('takes the header back to where it was opened from, the dashboard or the hub', async () => {
    await render(<StoryPublishScreen />);

    expect(mockBackHandlerOptions).toHaveBeenCalledWith({ showWebBackButton: true });
  });

  it('says the story is only on this device, and offers to send it to a server', async () => {
    mockFindStories.mockResolvedValue({ ...story, serverId: null });
    const view = await render(<StoryPublishScreen />);
    await view.findByText('story_publish_no_server_title');
    await fireEvent.press(view.getByTestId('story-publish-open-collaboration'));
    expect(mockNavigateAcross).toHaveBeenCalledWith(
      'StorySettings',
      'StorySettingsCollaboration',
      {},
    );
  });

  it('shows the error screen when loading fails', async () => {
    await withSilencedConsole(['log'], async () => {
      mockGetAllServers.mockRejectedValue(new Error('db down'));
      const view = await render(<StoryPublishScreen />);
      await view.findByText('failed_to_load_story');
    });
  });

  it('treats a story whose server is unknown locally as not on a server', async () => {
    mockFindStories.mockResolvedValue({ ...story, serverId: 'srv-x' });
    const view = await render(<StoryPublishScreen />);
    await view.findByText('story_publish_no_server_title');
  });

  it('leaves publishing to the owner', async () => {
    mockFindStories.mockResolvedValue({ ...story, myRole: 'writer' });
    const view = await render(<StoryPublishScreen />);
    await view.findByText('story_publish_not_owner_title');
    expect(view.queryByTestId('story-publish-submit')).toBeNull();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('explains why a story cannot be published right now', async () => {
    mockIsOffline.mockReturnValue(true);
    const offline = await render(<StoryPublishScreen />);
    await offline.findByText('publish_blocked_offline');
  });

  it('blocks publishing with pending operations or missing sync', async () => {
    mockFindLogs.mockResolvedValue([{ id: 'op-1' }]);
    const pending = await render(<StoryPublishScreen />);
    await pending.findByText('publish_blocked_pending_operations');

    // Behind the server's own sequence: somebody else wrote since this device last read it.
    mockFindLogs.mockResolvedValue([]);
    mockFindStories.mockResolvedValue({ ...story, lastServerSyncedLog: 3 });
    const unsynced = await render(<StoryPublishScreen />);
    await unsynced.findByText('publish_blocked_not_synced');
  });

  it('treats a story just sent up as synced, whatever its local counter', async () => {
    // Written offline (local counter 45), then uploaded: the server's sequence restarts at 0.
    mockFindStories.mockResolvedValue({ ...story, lastOperationLog: 45, lastServerSyncedLog: 0 });
    mockFetchPreviews.mockResolvedValue([{ storyId: 'story-1', lastOperationVersion: 0 }]);
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');

    expect(view.queryByText('publish_blocked_not_synced')).toBeNull();
    expect(view.getByText(/publish_synced_version/)).toBeTruthy();
    await fireEvent.press(await view.findByText('publish_create_version'));
    await waitFor(() => expect(mockPublish).toHaveBeenCalled());
    // The server checks the version in its own sequence.
    expect(mockPublish.mock.calls[0][2]).toBe(0);
  });

  it('leaves the stale check to the server when it cannot tell its version', async () => {
    mockFindStories.mockResolvedValue({ ...story, lastServerSyncedLog: 3 });
    mockFetchPreviews.mockResolvedValue([]);
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');

    expect(view.queryByText('publish_blocked_not_synced')).toBeNull();
  });

  it('publishes a new version and shows its public address', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
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
        undefined,
        undefined,
        true,
        undefined,
      ),
    );
    expect(mockSyncPubs).toHaveBeenCalledWith(server);
    expect(mockAlert).toHaveBeenCalledWith(
      'publish_version_created',
      expect.stringContaining('https://s.example/showcase/story/story-1'),
      expect.any(Array),
    );
    const open = alertButtons(0).find((b) => b.text === 'publish_open_link');
    await act(async () => {
      await open?.onPress?.();
    });
    expect(Linking.openURL).toHaveBeenCalledWith('https://s.example/showcase/story/story-1');
  });

  it('redraws a changed sketch picture first and asks for a sync instead of publishing a stale one', async () => {
    mockRefreshSnapshots.mockResolvedValue(2);
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('publish_snapshots_redrawn', 'warning'),
    );
    expect(mockRefreshSnapshots).toHaveBeenCalledWith(mockDrizzle, 'user-1', 'story-1');
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('requires a long enough password when the padlock is on', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await fireEvent.press(view.getByTestId('publish-password-switch'));
    await fireEvent.changeText(view.getByPlaceholderText('publish_password_placeholder'), 'abc');
    await fireEvent.press(view.getByText('publish_create_version'));
    expect(mockNotify).toHaveBeenCalledWith('publish_password_too_short', 'error');
    expect(mockPublish).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByPlaceholderText('publish_password_placeholder'), 'pw1234');
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() =>
      expect(mockPublish).toHaveBeenCalledWith(
        server,
        'story-1',
        5,
        'both',
        'password',
        'pw1234',
        undefined,
        undefined,
        true,
        undefined,
      ),
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
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await fireEvent.press(view.getByTestId('publish-password-switch'));
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
    await withSilencedConsole(['log'], async () => {
      const view = await render(<StoryPublishScreen />);
      await view.findByTestId('story-publish-status');
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

      // The plan's daily number of publications: its own message, not 'showcase disabled'.
      mockPublish.mockRejectedValueOnce({ response: { status: 429 } });
      await fireEvent.press(view.getByText('publish_create_version'));
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith('publish_limit_reached', 'error'),
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
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('v1');
    expect(view.getByText('https://s.example/showcase/story/story-1')).toBeTruthy();
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
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_unpublish_confirm');
    expect(view.getByText('publish_visibility_applies_to_all')).toBeTruthy();
    await fireEvent.press(view.getByText('publish_open_link'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://s.example/showcase/story/story-1');
    await fireEvent.press(view.getByText('publish_unpublish_confirm'));
    const confirm = alertButtons(0).find((b) => b.text === 'publish_unpublish_confirm');
    await act(async () => {
      await confirm?.onPress?.();
    });
    await waitFor(() => expect(mockUnpublish).toHaveBeenCalledWith(server, 'story-1'));
    expect(mockNotify).toHaveBeenCalledWith('publish_unpublished', 'success');
  });

  it('lays what goes out beside who sees it on a wide screen', async () => {
    mockCompact.current = false;
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-columns');

    expect(StyleSheet.flatten(view.getByTestId('story-publish-columns').props.style)).toMatchObject(
      {
        flexDirection: 'row',
      },
    );
  });

  it('stacks them on a narrow screen', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-columns');

    expect(view.getByTestId('story-publish-columns').props.style).toBeUndefined();
  });

  it('copies the public link to the clipboard', async () => {
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
      ],
    });
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-copy-link');

    await fireEvent.press(view.getByTestId('story-publish-copy-link'));
    await waitFor(() =>
      expect(mockSetClipboard).toHaveBeenCalledWith('https://s.example/showcase/story/story-1'),
    );
    expect(mockNotify).toHaveBeenCalledWith('publish_link_copied', 'success');
  });

  it('offers no way to copy a link before anything is published', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    expect(view.queryByTestId('story-publish-copy-link')).toBeNull();
  });

  it('marks which version name is chosen, as a radio group does', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');

    const chosen = view
      .getAllByRole('radio')
      .filter((radio) => radio.props.accessibilityState.selected);
    expect(view.getAllByRole('radio')).toHaveLength(3);
    expect(chosen).toHaveLength(1);
  });

  it('keeps the local mirror when the server state cannot be read', async () => {
    mockGetShowcase.mockRejectedValue({ isOffline: true });
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    expect(view.getByText(/publish_not_published/)).toBeTruthy();
  });

  it('attaches the manuscript with options and localized labels, never bytes', async () => {
    mockGetChapters.mockResolvedValue([{ id: 'ch-1', type: 'chapter' }]);
    mockGetScenes.mockResolvedValue([
      { id: 's-1', chapterId: 'ch-1', isDeleted: false },
      { id: 's-2', chapterId: null, isDeleted: false },
    ]);
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    expect(mockGetChapters).toHaveBeenCalledWith('story-1', null);
    expect(mockGetScenes).toHaveBeenCalledWith('story-1');
    expect(mockGetArcs).toHaveBeenCalledWith('story-1');
    expect(view.queryByTestId('publish-manuscript-options-story-1')).toBeNull();

    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await view.findByTestId('publish-manuscript-options-story-1');
    for (const format of ['docx', 'pdf', 'epub', 'html', 'md', 'txt']) {
      expect(view.getByTestId(`export-format-${format}`)).toBeTruthy();
    }
    expect(view.getByTestId('export-loose').props.accessibilityState).toMatchObject({
      checked: false,
    });

    await fireEvent.press(view.getByTestId('export-format-md'));
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() =>
      expect(mockPublish).toHaveBeenCalledWith(
        server,
        'story-1',
        5,
        'both',
        'public',
        undefined,
        manuscriptPayload({ format: 'md' }),
        undefined,
        true,
        undefined,
      ),
    );
    const sent = mockPublish.mock.calls[0][6];
    expect(sent.routeId).toBeUndefined();
    expect(JSON.stringify(sent)).not.toContain('Uint8Array');
  });

  it('sends the same options the device export offers', async () => {
    mockFindStories.mockResolvedValue({ ...story, author: 'Ana' });
    mockGetChapters.mockResolvedValue([{ id: 'ch-1', type: 'chapter' }]);
    mockGetScenes.mockResolvedValue([{ id: 's-2', chapterId: null, isDeleted: false }]);
    mockGetArcs.mockResolvedValue([
      { id: 'arc-1', title: 'One' },
      { id: 'arc-2', title: 'Two' },
    ]);
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await view.findByTestId('publish-manuscript-options-story-1');
    // The preset list follows the server formats: all three have theirs there.
    await fireEvent.press(view.getByTestId('export-preset-ebook'));
    await fireEvent.press(view.getByTestId('export-arc-arc-2'));
    await fireEvent(view.getByTestId('export-loose'), 'valueChange', true);
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    const sent = mockPublish.mock.calls[0][6];
    expect(sent).toMatchObject({
      format: 'epub',
      includeToc: true,
      includeSceneNames: false,
      includeLooseScenes: true,
      arcId: 'arc-2',
      author: 'Ana',
      language: 'en',
    });
    expect(sent.style).toMatchObject({
      quotes: 'curly',
      frontMatter: ['export_manuscript_title_page_by', 'export_manuscript_title_page_copyright'],
      placeholders: { author: 'Ana' },
    });
  });

  it('offers the songs only where one is sung, and sends the choices for them', async () => {
    mockSungSongs = true;
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await view.findByTestId('publish-manuscript-options-story-1');
    await fireEvent(await view.findByTestId('export-songs'), 'valueChange', true);
    await fireEvent.press(view.getByTestId('export-songs-placement-after-scene'));
    await fireEvent.press(view.getByTestId('export-songs-language-both'));
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish.mock.calls[0][6]).toMatchObject({
      includeSongs: true,
      songsPlacement: 'after-scene',
      songLanguage: 'both',
      songRepeat: 'first-only',
      songChords: false,
    });
    mockSungSongs = false;
  });

  it('asks nothing about songs where none is sung', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await view.findByTestId('publish-manuscript-options-story-1');
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(view.queryByTestId('export-songs')).toBeNull();
    expect(mockPublish.mock.calls[0][6]).not.toHaveProperty('includeSongs');
  });

  it('releases one work: no package, its own author, the arc in the request', async () => {
    mockFindStories.mockResolvedValue({ ...story, author: 'Story Author' });
    mockGetArcs.mockResolvedValue([
      { id: 'arc-1', title: 'Issue One', author: 'Arc Author', medium: 'comic' },
      { id: 'arc-2', title: 'Issue Two', author: null, medium: 'comic' },
    ]);
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');
    expect(view.getByTestId('publish-package-switch-story-1')).toBeTruthy();

    await fireEvent.press(view.getByTestId('route-option-arc-1'));
    // The package is the whole story: it is not offered for one work.
    expect(view.queryByTestId('publish-package-switch-story-1')).toBeNull();
    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    const call = mockPublish.mock.calls[0];
    expect(call[8]).toBe(false);
    expect(call[9]).toBe('arc-1');
    expect(call[6]).toMatchObject({ arcId: 'arc-1', author: 'Arc Author' });
  });

  it('sends the frame and the noun of the work whose pages it releases, and nothing of the kind for prose', async () => {
    mockGetArcs.mockResolvedValue([
      { id: 'arc-1', title: 'Board', author: null, medium: 'storyboard', pageFormat: null },
      { id: 'arc-2', title: 'Book', author: null, medium: 'generic', pageFormat: null },
    ]);
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');
    await fireEvent.press(view.getByTestId('route-option-arc-1'));
    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish.mock.calls[0][6]).toMatchObject({ pageNoun: 'frame', pageFormat: 'wide' });

    mockPublish.mockClear();
    await fireEvent.press(view.getByTestId('route-option-arc-2'));
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish.mock.calls[0][6]).not.toHaveProperty('pageFormat');
    expect(mockPublish.mock.calls[0][6]).not.toHaveProperty('pageNoun');
  });

  it('credits the story author when the released work has none', async () => {
    mockFindStories.mockResolvedValue({ ...story, author: 'Story Author' });
    mockGetArcs.mockResolvedValue([
      { id: 'arc-1', title: 'Issue One', author: 'Arc Author', medium: 'comic' },
      { id: 'arc-2', title: 'Issue Two', author: null, medium: 'comic' },
    ]);
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('route-option-arc-2'));
    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish.mock.calls[0][6]).toMatchObject({ arcId: 'arc-2', author: 'Story Author' });
  });

  it('warns that loose scenes go into the release of every work', async () => {
    mockGetChapters.mockResolvedValue([{ id: 'ch-1', type: 'chapter' }]);
    mockGetScenes.mockResolvedValue([{ id: 's-2', chapterId: null, isDeleted: false }]);
    mockGetArcs.mockResolvedValue([
      { id: 'arc-1', title: 'One', author: null, medium: 'generic' },
      { id: 'arc-2', title: 'Two', author: null, medium: 'generic' },
    ]);
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('route-option-arc-1'));
    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    expect(view.queryByTestId('publish-release-loose-hint-story-1')).toBeNull();
    await fireEvent(view.getByTestId('export-loose'), 'valueChange', true);

    expect(view.getByTestId('publish-release-loose-hint-story-1')).toBeTruthy();
  });

  it('goes back to the whole universe, with the package on again', async () => {
    mockGetArcs.mockResolvedValue([
      { id: 'arc-1', title: 'One', author: null, medium: 'generic' },
      { id: 'arc-2', title: 'Two', author: null, medium: 'generic' },
    ]);
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('route-option-arc-1'));
    await fireEvent.press(view.getByTestId('route-option-universe'));
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish.mock.calls[0][8]).toBe(true);
    expect(mockPublish.mock.calls[0][9]).toBeUndefined();
  });

  it('does not offer to release a work in a story with a single one', async () => {
    mockGetArcs.mockResolvedValue([
      { id: 'arc-1', title: 'Only', author: null, medium: 'generic' },
    ]);
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    expect(view.queryByTestId('publish-release-story-1')).toBeNull();
  });

  it('says the plan has no room for another work on a 429 of a release', async () => {
    mockGetArcs.mockResolvedValue([
      { id: 'arc-1', title: 'One', author: null, medium: 'generic' },
      { id: 'arc-2', title: 'Two', author: null, medium: 'generic' },
    ]);
    mockPublish.mockRejectedValueOnce({ response: { status: 429 } });
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('route-option-arc-2'));
    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('publish_works_limit_reached', 'error'),
    );
  });

  it('offers a branching story its scene order instead of a route, discovery by default', async () => {
    mockFindStories.mockResolvedValue({ ...story, type: 'branching' });
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await view.findByTestId('export-scene-order-discovery');
    expect(view.queryByTestId('route-picker-value')).toBeNull();
    expect(view.queryByTestId('export-loose')).toBeNull();
    expect(view.queryByTestId('export-reset-numbers')).toBeNull();

    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() =>
      expect(mockPublish).toHaveBeenCalledWith(
        server,
        'story-1',
        5,
        'both',
        'public',
        undefined,
        manuscriptPayload({ sceneOrder: 'discovery' }),
        undefined,
        true,
        undefined,
      ),
    );
  });

  it('sends the shuffled order a branching story asks for', async () => {
    mockFindStories.mockResolvedValue({ ...story, type: 'branching' });
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await fireEvent.press(await view.findByTestId('export-scene-order-shuffled'));
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish.mock.calls[0][6]).toMatchObject({ sceneOrder: 'shuffled' });
    expect(mockPublish.mock.calls[0][6]).not.toHaveProperty('routeId');
  });

  it('leaves a linear story without a scene order', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await view.findByTestId('publish-manuscript-options-story-1');
    expect(view.queryByTestId('export-scene-order-discovery')).toBeNull();
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish.mock.calls[0][6]).not.toHaveProperty('sceneOrder');
  });

  it('publishes the reading online with the manuscript choices, no file format, its own words', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('publish-reader-switch-story-1'));
    await view.findByTestId('publish-manuscript-options-story-1');
    // No file is made: the format is not asked, and no manuscript travels.
    expect(view.queryByTestId('export-format-docx')).toBeNull();
    await fireEvent.press(view.getByTestId('export-quotes-curly'));
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    const [manuscript, reader] = [mockPublish.mock.calls[0][6], mockPublish.mock.calls[0][7]];
    expect(manuscript).toBeUndefined();
    expect(reader).not.toHaveProperty('format');
    expect(reader.style).toMatchObject({ quotes: 'curly' });
    expect(reader.readerLabels).toMatchObject({
      back: 'reader_back',
      newGame: 'reader_new_game',
      theEnd: 'reader_the_end',
      close: 'close',
    });
    expect(reader.labels).toMatchObject({ endOfExcerpt: 'export_manuscript_end_of_excerpt' });
  });

  it('sends the manuscript and the reader together, and the scene order to a branching one', async () => {
    mockFindStories.mockResolvedValue({ ...story, type: 'branching' });
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await fireEvent.press(view.getByTestId('publish-reader-switch-story-1'));
    await fireEvent.press(await view.findByTestId('export-scene-order-shuffled'));
    expect(view.getByTestId('export-format-docx')).toBeTruthy();
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish.mock.calls[0][6]).toMatchObject({ format: 'docx', sceneOrder: 'shuffled' });
    expect(mockPublish.mock.calls[0][7]).toMatchObject({ sceneOrder: 'shuffled' });
  });

  it('says so when the server publishes the version but drops the reading it was asked for', async () => {
    // An old server answers without the reader's size: the field is simply not there.
    mockPublish.mockResolvedValue({ label: 'v1' });
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');
    await fireEvent.press(view.getByTestId('publish-reader-switch-story-1'));
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('publish_extras_ignored', 'error'));
  });

  it('stays quiet when the server did publish the reading', async () => {
    mockPublish.mockResolvedValue({ label: 'v1', readerByteSize: 1200 });
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');
    await fireEvent.press(view.getByTestId('publish-reader-switch-story-1'));
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockNotify).not.toHaveBeenCalledWith('publish_extras_ignored', 'error');
  });

  it('publishes the story file by default, and says to select at least one', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    expect(view.getByText('publish_select_one')).toBeTruthy();
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish.mock.calls[0][8]).toBe(true);
  });

  it('publishes the reading alone once the story file is switched off', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('publish-reader-switch-story-1'));
    await fireEvent.press(view.getByTestId('publish-package-switch-story-1'));
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish.mock.calls[0][7]).toBeDefined();
    expect(mockPublish.mock.calls[0][8]).toBe(false);
  });

  it('will not publish a version with nothing in it: the button is off and pressing says why', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');

    await fireEvent.press(view.getByTestId('publish-package-switch-story-1'));
    await fireEvent.press(view.getByText('publish_create_version'));

    expect(mockPublish).not.toHaveBeenCalled();
    expect(view.getByText('publish_select_one')).toBeTruthy();
    // Switching one back on lifts it.
    await fireEvent.press(view.getByTestId('publish-manuscript-switch-story-1'));
    await fireEvent.press(view.getByText('publish_create_version'));
    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
  });

  it('sends no reader unless asked', async () => {
    const view = await render(<StoryPublishScreen />);
    await view.findByTestId('story-publish-status');
    await view.findByText('publish_create_version');
    await fireEvent.press(view.getByText('publish_create_version'));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledTimes(1));
    expect(mockPublish.mock.calls[0][7]).toBeUndefined();
  });
});
