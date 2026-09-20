const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockDrizzle = {};
const mockGetAllStories = jest.fn();
const mockExportFullStory = jest.fn();
const mockImportFullStory = jest.fn();
const mockWriteDownloaded = jest.fn();
const mockFetchStoryList = jest.fn();
const mockNotify = jest.fn();
const mockBuildZipBytes = jest.fn();
const mockDeliverExport = jest.fn();
const mockDeliverZipExport = jest.fn();
const mockPickFile = jest.fn();
const mockDispatch = jest.fn();
const mockSetTheme = jest.fn();
const mockUserSettings = { userId: 'user-1' as string | null };
const mockNotificationState = { showNotification: (...args: unknown[]) => mockNotify(...args) };
const mockStoryListState = { fetchStories: (...args: unknown[]) => mockFetchStoryList(...args) };
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

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = callback();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
    useNavigation: () => ({ dispatch: mockDispatch }),
    DrawerActions: { closeDrawer: () => ({ type: 'CLOSE_DRAWER' }) },
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

jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  createStoryService: () => ({
    getAllStories: (...args: unknown[]) => mockGetAllStories(...args),
    exportFullStory: (...args: unknown[]) => mockExportFullStory(...args),
    importFullStory: (...args: unknown[]) => mockImportFullStory(...args),
  }),
}));

jest.mock('../../../src/services/MediaFileService', () => ({
  mediaFileService: {
    writeDownloaded: (...args: unknown[]) => mockWriteDownloaded(...args),
  },
}));

jest.mock('../../../src/utils/storyMediaBundle', () => ({
  buildStoryZipBytes: (...args: unknown[]) => mockBuildZipBytes(...args),
}));

jest.mock('../../../src/utils/storyTransfer', () => {
  class StoryImportError extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  }
  return {
    StoryImportError,
    buildExportFileName: (title: string) => `${title}.json`,
    buildExportZipFileName: (title: string) => `${title}.zip`,
    deliverStoryExport: (...args: unknown[]) => mockDeliverExport(...args),
    deliverStoryZipExport: (...args: unknown[]) => mockDeliverZipExport(...args),
    pickStoryExportFile: (...args: unknown[]) => mockPickFile(...args),
  };
});

jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockNotificationState) : mockNotificationState,
}));

jest.mock('../../../src/state/storyListStore', () => ({
  useStoryListStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockStoryListState) : mockStoryListState,
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockUserSettings) : mockUserSettings,
}));

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import ImportExportScreen from '../../../src/screens/enterstack/ImportExportScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const stories = [
  { id: 'story-1', title: 'Epic', type: 'linear' },
  { id: 'story-2', title: 'Branches', type: 'branching' },
];

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

function alertButtons(callIndex = 0): AlertButton[] {
  return mockAlert.mock.calls[callIndex][2] as AlertButton[];
}

describe('ImportExportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserSettings.userId = 'user-1';
    mockGetAllStories.mockResolvedValue(stories);
    mockExportFullStory.mockResolvedValue({ story: { title: 'Epic' } });
    mockImportFullStory.mockResolvedValue(undefined);
    mockWriteDownloaded.mockResolvedValue('/local/hash1');
    mockBuildZipBytes.mockResolvedValue({
      bytes: new Uint8Array([1]),
      includedCount: 2,
      totalCount: 2,
    });
    mockDeliverExport.mockResolvedValue({ delivered: true, fileName: 'Epic.json' });
    mockDeliverZipExport.mockResolvedValue({ delivered: true, fileName: 'Epic.zip' });
    mockPickFile.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it('lists stories with their type label', async () => {
    const view = await render(<ImportExportScreen />);
    await view.findByText('Epic');
    expect(view.getByText('Branches')).toBeTruthy();
    expect(view.getByText('linear')).toBeTruthy();
    expect(view.getByText('branching')).toBeTruthy();
    expect(view.getByText('import_story_description')).toBeTruthy();
    expect(view.getByText('export_story_description')).toBeTruthy();
  });

  it('shows the error and empty states', async () => {
    await withSilencedConsole(['log'], async () => {
      mockGetAllStories.mockRejectedValueOnce(new Error('db down'));
      const failed = await render(<ImportExportScreen />);
      await failed.findByText('failed_to_load_stories');

      mockGetAllStories.mockResolvedValue([]);
      const empty = await render(<ImportExportScreen />);
      await empty.findByText('export_story_no_stories');
    });
  });

  it('exports a story as JSON', async () => {
    const view = await render(<ImportExportScreen />);
    await view.findByText('Epic');
    await fireEvent.press(view.getByText('Epic'));
    expect(mockAlert).toHaveBeenCalledWith(
      'export_story_choose_title',
      'export_story_choose_message',
      expect.any(Array),
    );
    const json = alertButtons(0).find((b) => b.text === 'export_story_choose_json');
    await act(async () => {
      await json?.onPress?.();
    });
    await waitFor(() => expect(mockExportFullStory).toHaveBeenCalledWith('story-1'));
    expect(mockDeliverExport).toHaveBeenCalledWith({ story: { title: 'Epic' } }, 'Epic.json');
    expect(mockNotify).toHaveBeenCalledWith('export_story_success', 'success');
  });

  it('reports JSON exports without a reachable file', async () => {
    mockDeliverExport.mockResolvedValue({ delivered: false, fileName: 'Epic.json', uri: '/tmp/x' });
    const view = await render(<ImportExportScreen />);
    await view.findByText('Epic');
    await fireEvent.press(view.getByText('Epic'));
    const json = alertButtons(0).find((b) => b.text === 'export_story_choose_json');
    await act(async () => {
      await json?.onPress?.();
    });
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('export_story_no_share_target', 'warning'),
    );
  });

  it('reports JSON export failures', async () => {
    await withSilencedConsole(['log'], async () => {
      mockExportFullStory.mockRejectedValue(new Error('boom'));
      const view = await render(<ImportExportScreen />);
      await view.findByText('Epic');
      await fireEvent.press(view.getByText('Epic'));
      const json = alertButtons(0).find((b) => b.text === 'export_story_choose_json');
      await act(async () => {
        await json?.onPress?.();
      });
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('export_story_failed', 'error'));
    });
  });

  it('exports a story as ZIP with its media', async () => {
    const view = await render(<ImportExportScreen />);
    await view.findByText('Epic');
    await fireEvent.press(view.getByText('Epic'));
    const zip = alertButtons(0).find((b) => b.text === 'export_story_choose_zip');
    await act(async () => {
      await zip?.onPress?.();
    });
    await waitFor(() => expect(mockBuildZipBytes).toHaveBeenCalled());
    expect(mockDeliverZipExport).toHaveBeenCalledWith(expect.any(Uint8Array), 'Epic.zip');
    expect(mockNotify).toHaveBeenCalledWith('export_story_success', 'success');
  });

  it('warns about partial ZIP exports and ZIP failures', async () => {
    await withSilencedConsole(['log'], async () => {
      mockBuildZipBytes.mockResolvedValue({
        bytes: new Uint8Array([1]),
        includedCount: 1,
        totalCount: 3,
      });
      const view = await render(<ImportExportScreen />);
      await view.findByText('Epic');
      await fireEvent.press(view.getByText('Epic'));
      const zip = alertButtons(0).find((b) => b.text === 'export_story_choose_zip');
      await act(async () => {
        await zip?.onPress?.();
      });
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith('export_story_zip_success_partial', 'warning'),
      );

      mockBuildZipBytes.mockRejectedValueOnce(new Error('zip boom'));
      await fireEvent.press(view.getByText('Epic'));
      const retry = alertButtons(1).find((b) => b.text === 'export_story_choose_zip');
      await act(async () => {
        await retry?.onPress?.();
      });
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('export_story_failed', 'error'));
    });
  });

  it('imports a story file with its media', async () => {
    mockPickFile.mockResolvedValue({
      story: { story: { title: 'Restored' } },
      media: [{ hash: 'h1', mimeType: 'image/png', bytes: new Uint8Array([9]) }],
    });
    const view = await render(<ImportExportScreen />);
    await view.findByText('import_story_choose_file');
    await fireEvent.press(view.getByText('import_story_choose_file'));
    await waitFor(() => expect(mockImportFullStory).toHaveBeenCalled());
    // The drawer is put away before the picker covers the app and once it returns.
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLOSE_DRAWER' });
    expect(mockWriteDownloaded).toHaveBeenCalledWith(
      expect.any(String),
      'h1',
      'image/png',
      expect.any(Uint8Array),
    );
    expect(mockImportFullStory).toHaveBeenCalledWith(
      'user-1',
      { story: { title: 'Restored' } },
      null,
      null,
      expect.any(Map),
      expect.any(String),
    );
    expect(mockNotify).toHaveBeenCalledWith('import_story_success', 'success');
    expect(mockFetchStoryList).toHaveBeenCalled();
  });

  it('ignores a cancelled picker and a missing user', async () => {
    const view = await render(<ImportExportScreen />);
    await view.findByText('import_story_choose_file');
    await fireEvent.press(view.getByText('import_story_choose_file'));
    await waitFor(() => expect(mockPickFile).toHaveBeenCalled());
    expect(mockImportFullStory).not.toHaveBeenCalled();

    mockUserSettings.userId = null;
    const loggedOut = await render(<ImportExportScreen />);
    await loggedOut.findByText('import_story_choose_file');
    await fireEvent.press(loggedOut.getByText('import_story_choose_file'));
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('user_not_identified', 'error'));
  });

  it('maps import rejections to specific messages', async () => {
    await withSilencedConsole(['log'], async () => {
      const { StoryImportError } = jest.requireMock('../../../src/utils/storyTransfer') as {
        StoryImportError: new (reason: string) => Error;
      };
      const view = await render(<ImportExportScreen />);
      await view.findByText('import_story_choose_file');

      for (const [reason, message] of [
        ['future_format_version', 'import_story_future_version'],
        ['invalid_format', 'import_story_invalid_file'],
        ['corrupt_content', 'import_story_corrupt_content'],
        ['unknown', 'import_story_unreadable_file'],
      ] as const) {
        mockPickFile.mockResolvedValueOnce({ story: {}, media: [] });
        mockImportFullStory.mockRejectedValueOnce(new StoryImportError(reason));
        await fireEvent.press(view.getByText('import_story_choose_file'));
        await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(message, 'error'));
      }

      mockPickFile.mockResolvedValueOnce({ story: {}, media: [] });
      mockImportFullStory.mockRejectedValueOnce(new Error('boom'));
      await fireEvent.press(view.getByText('import_story_choose_file'));
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('import_story_failed', 'error'));
    });
  });
});
