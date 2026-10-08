const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockDrizzle = {};
const mockImportFullStory = jest.fn();
const mockWriteDownloaded = jest.fn();
const mockFetchStoryList = jest.fn();
const mockNotify = jest.fn();
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
      }, [callback]);
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

jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  createStoryService: () => ({
    importFullStory: (...args: unknown[]) => mockImportFullStory(...args),
  }),
}));

jest.mock('../../../src/services/MediaFileService', () => ({
  mediaFileService: {
    writeDownloaded: (...args: unknown[]) => mockWriteDownloaded(...args),
  },
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

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import ImportStoryScreen from '../../../src/screens/enterstack/ImportStoryScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

describe('ImportStoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserSettings.userId = 'user-1';
    mockImportFullStory.mockResolvedValue(undefined);
    mockWriteDownloaded.mockResolvedValue('/local/hash1');
    mockPickFile.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  it('says what it takes and where a story is taken out instead', async () => {
    const view = await render(<ImportStoryScreen />);
    expect(view.getByText('import_story_description')).toBeTruthy();
    expect(view.getByText('import_story_export_elsewhere')).toBeTruthy();
  });

  it('imports a story file with its media', async () => {
    mockPickFile.mockResolvedValue({
      story: { story: { title: 'Restored' } },
      media: [{ hash: 'h1', mimeType: 'image/png', bytes: new Uint8Array([9]) }],
    });
    const view = await render(<ImportStoryScreen />);
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
    const view = await render(<ImportStoryScreen />);
    await fireEvent.press(view.getByText('import_story_choose_file'));
    await waitFor(() => expect(mockPickFile).toHaveBeenCalled());
    expect(mockImportFullStory).not.toHaveBeenCalled();

    mockUserSettings.userId = null;
    const loggedOut = await render(<ImportStoryScreen />);
    await fireEvent.press(loggedOut.getByText('import_story_choose_file'));
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('user_not_identified', 'error'));
  });

  it('maps import rejections to specific messages', async () => {
    await withSilencedConsole(['log'], async () => {
      const { StoryImportError } = jest.requireMock('../../../src/utils/storyTransfer') as {
        StoryImportError: new (reason: string) => Error;
      };
      const view = await render(<ImportStoryScreen />);

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
