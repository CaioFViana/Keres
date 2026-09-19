const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockParentNavigate = jest.fn();
const mockNavigation = {
  navigate: (...args: unknown[]) => mockNavigate(...args),
  replace: (...args: unknown[]) => mockReplace(...args),
  getParent: () => ({ navigate: (...args: unknown[]) => mockParentNavigate(...args) }),
};
const mockUseScreenHeader = jest.fn();
const mockUseScreenTour = jest.fn();
const mockDrizzle = {};
const mockGetAllServers = jest.fn();
const mockGetCatalogCounts = jest.fn();
const mockGetContentCounts = jest.fn();
const mockUpdateFavorite = jest.fn();
const mockNotify = jest.fn();
const mockFetchStories = jest.fn();
const mockUpdateStoryFavoriteStatus = jest.fn();
const mockSetSelectedStory = jest.fn();
const mockUpdateSummary = jest.fn();
const mockSetTheme = jest.fn();
const mockBackHandler = { current: null as null | (() => boolean | null | undefined) };
const mockStoryListState = {
  stories: [] as unknown[],
  fetchStories: (...args: unknown[]) => mockFetchStories(...args),
  updateStoryFavoriteStatus: (...args: unknown[]) => mockUpdateStoryFavoriteStatus(...args),
};
const mockSummaryState = {
  summary: null as null | Record<string, unknown>,
  updateSummary: (...args: unknown[]) => mockUpdateSummary(...args),
};
const mockStoryState = { setSelectedStory: (...args: unknown[]) => mockSetSelectedStory(...args) };
const mockSetFirstStoryProgress = jest.fn();
const mockUserSettings = {
  userId: 'user-1' as string | null,
  showTutorials: false,
  tutorialProgress: { version: 1, seen: [] as string[] } as {
    version: number;
    seen: string[];
    firstStory?: { choice: string | null; done: boolean; dismissed: boolean };
  },
  setFirstStoryProgress: (...args: unknown[]) => mockSetFirstStoryProgress(...args),
};
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

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useIsFocused: () => true,
}));

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: mockSetTheme, colors: mockColors }),
  };
});

jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock('../../../src/guides/useScreenTour', () => ({
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
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

jest.mock('../../../src/services/storymanagement/StoryContentMetricsService', () => ({
  createStoryContentMetricsService: () => ({
    getCatalogCounts: (...args: unknown[]) => mockGetCatalogCounts(...args),
    getContentCounts: (...args: unknown[]) => mockGetContentCounts(...args),
  }),
}));

jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  createStoryService: () => ({
    updateStoryFavoriteStatus: (...args: unknown[]) => mockUpdateFavorite(...args),
  }),
}));

jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockNotificationState) : mockNotificationState,
}));

jest.mock('../../../src/state/storyListStore', () => ({
  useStoryListStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockStoryListState) : mockStoryListState,
}));

jest.mock('../../../src/state/storyStore', () => ({
  useStoryStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockStoryState) : mockStoryState,
}));

jest.mock('../../../src/state/summaryStore', () => ({
  useSummaryStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockSummaryState) : mockSummaryState,
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockUserSettings) : mockUserSettings,
}));

jest.mock('../../../src/components/common/display/SummaryCard/SummaryCard', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { title?: string; characterCount?: number; sceneCount?: number }) => (
      <Text testID="summary-card">
        {JSON.stringify({
          title: props.title ?? null,
          characters: props.characterCount ?? null,
          scenes: props.sceneCount ?? null,
        })}
      </Text>
    ),
  };
});

type ListItemProps = {
  story: { id: string; title: string; isFavorite: boolean };
  serverName?: string;
  onSelectStory: (story: unknown) => void;
  onToggleFavorite: (storyId: string, current: boolean) => void;
  onEditStory: (storyId: string) => void;
};

jest.mock('../../../src/components/features/list-items/StorySelectionListItem', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: ListItemProps) => (
      <>
        <Text testID={`story-${props.story.id}`}>
          {JSON.stringify({
            title: props.story.title,
            serverName: props.serverName ?? null,
          })}
        </Text>
        <Text testID={`select-${props.story.id}`} onPress={() => props.onSelectStory(props.story)}>
          select
        </Text>
        <Text
          testID={`fav-${props.story.id}`}
          onPress={() => props.onToggleFavorite(props.story.id, props.story.isFavorite)}
        >
          fav
        </Text>
        <Text testID={`edit-${props.story.id}`} onPress={() => props.onEditStory(props.story.id)}>
          edit
        </Text>
      </>
    ),
  };
});

import type { Story } from '@keres/shared/entities/Story';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import StorySelectionScreen from '../../../src/screens/enterstack/StorySelectionScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const story = {
  id: 'story-1',
  title: 'Epic',
  theme: 'ocean',
  isFavorite: false,
  serverId: 'srv-1',
} as unknown as Story;

describe('StorySelectionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBackHandler.current = null;
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event: string, handler: () => boolean | null | undefined) => {
        mockBackHandler.current = handler;
        return { remove: jest.fn() };
      });
    jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
    mockStoryListState.stories = [story];
    mockSummaryState.summary = { characterCount: 3, sceneCount: 7 };
    mockUserSettings.userId = 'user-1';
    mockUserSettings.showTutorials = false;
    mockUserSettings.tutorialProgress = { version: 1, seen: [] };
    mockSetFirstStoryProgress.mockResolvedValue(undefined);
    mockGetAllServers.mockResolvedValue([{ id: 'srv-1', name: 'Main' }]);
    mockGetCatalogCounts.mockResolvedValue({ characterCount: 3 });
    mockGetContentCounts.mockResolvedValue({ sceneCount: 7 });
    mockUpdateFavorite.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('loads stories, summary and server names on focus', async () => {
    const view = await render(<StorySelectionScreen />);
    await view.findByTestId('story-story-1');
    expect(JSON.parse(view.getByTestId('story-story-1').props.children as string)).toEqual({
      title: 'Epic',
      serverName: 'Main',
    });
    expect(JSON.parse(view.getByTestId('summary-card').props.children as string)).toEqual({
      title: 'global_summary',
      characters: 3,
      scenes: 7,
    });
    expect(view.getByText('your_stories')).toBeTruthy();
    expect(mockFetchStories).toHaveBeenCalled();
    expect(mockSetTheme).toHaveBeenCalledWith('default');
    await waitFor(() =>
      expect(mockUpdateSummary).toHaveBeenCalledWith(
        expect.objectContaining({ characterCount: 3, sceneCount: 7 }),
      ),
    );
  });

  it('requests its guided tour', async () => {
    await render(<StorySelectionScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('StorySelectionMain');
  });

  describe('first-story trail', () => {
    const renderEmpty = async () => {
      mockStoryListState.stories = [];
      mockUserSettings.showTutorials = true;
      const view = await render(<StorySelectionScreen />);
      await view.findByText('first_story_cta');
      return view;
    };

    const choiceButtons = () =>
      mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];

    it('offers the trail from the empty state', async () => {
      const view = await renderEmpty();

      await fireEvent.press(view.getByText('first_story_cta'));

      expect(mockAlert).toHaveBeenCalledWith(
        'first_story_choice_title',
        'first_story_choice_message',
        expect.arrayContaining([
          expect.objectContaining({ text: 'first_story_choice_create' }),
          expect.objectContaining({ text: 'first_story_choice_example' }),
          expect.objectContaining({ text: 'first_story_choice_later' }),
        ]),
        { cancelable: true },
      );
    });

    it('records the create choice and opens the form', async () => {
      const view = await renderEmpty();
      await fireEvent.press(view.getByText('first_story_cta'));

      choiceButtons()[0].onPress?.();

      expect(mockNavigate).toHaveBeenCalledWith('StoryForm', {});
      await waitFor(() =>
        expect(mockSetFirstStoryProgress).toHaveBeenCalledWith(mockDrizzle, {
          choice: 'create',
        }),
      );
    });

    it('records the example choice and opens the examples', async () => {
      const view = await renderEmpty();
      await fireEvent.press(view.getByText('first_story_cta'));

      choiceButtons()[1].onPress?.();

      expect(mockParentNavigate).toHaveBeenCalledWith('ExampleStories');
      await waitFor(() =>
        expect(mockSetFirstStoryProgress).toHaveBeenCalledWith(mockDrizzle, {
          choice: 'example',
        }),
      );
    });

    it('silences the trail without navigating when dismissed', async () => {
      const view = await renderEmpty();
      await fireEvent.press(view.getByText('first_story_cta'));

      choiceButtons()[2].onPress?.();

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockParentNavigate).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(mockSetFirstStoryProgress).toHaveBeenCalledWith(mockDrizzle, {
          dismissed: true,
        }),
      );
    });

    it('hides the call to action once the trail is done, dismissed or switched off', async () => {
      mockStoryListState.stories = [];
      mockUserSettings.showTutorials = true;
      mockUserSettings.tutorialProgress = {
        version: 1,
        seen: [],
        firstStory: { choice: 'create', done: true, dismissed: false },
      };
      const done = await render(<StorySelectionScreen />);
      await done.findByText('no_stories_found_create_one');
      expect(done.queryByText('first_story_cta')).toBeNull();

      mockUserSettings.tutorialProgress = {
        version: 1,
        seen: [],
        firstStory: { choice: null, done: false, dismissed: true },
      };
      const dismissed = await render(<StorySelectionScreen />);
      await dismissed.findByText('no_stories_found_create_one');
      expect(dismissed.queryByText('first_story_cta')).toBeNull();

      mockUserSettings.showTutorials = false;
      mockUserSettings.tutorialProgress = { version: 1, seen: [] };
      const off = await render(<StorySelectionScreen />);
      await off.findByText('no_stories_found_create_one');
      expect(off.queryByText('first_story_cta')).toBeNull();
    });
  });

  it('shows the empty state without stories or summary', async () => {
    mockStoryListState.stories = [];
    mockSummaryState.summary = null;
    const view = await render(<StorySelectionScreen />);
    await view.findByText('no_stories_found_create_one');
    expect(view.queryByTestId('summary-card')).toBeNull();
  });

  it('reports summary failures', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetCatalogCounts.mockRejectedValue(new Error('boom'));
      const view = await render(<StorySelectionScreen />);
      await view.findByTestId('story-story-1');
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_load_summary_data'),
      );
    });
  });

  it('selects a story and opens the creation form', async () => {
    const view = await render(<StorySelectionScreen />);
    await view.findByTestId('select-story-1');
    await fireEvent.press(view.getByTestId('select-story-1'));
    expect(mockSetSelectedStory).toHaveBeenCalledWith(story);
    expect(mockSetTheme).toHaveBeenCalledWith('ocean');
    expect(mockReplace).toHaveBeenCalledWith('MainSystem', { storyId: 'story-1' });

    const header = mockUseScreenHeader.mock.calls[0][0] as {
      actions: Array<{ onPress: () => void }>;
    };
    header.actions[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('StoryForm', {});

    await fireEvent.press(view.getByTestId('edit-story-1'));
    expect(mockNavigate).toHaveBeenCalledWith('StoryForm', { storyId: 'story-1' });
  });

  it('toggles story favorites', async () => {
    await withSilencedConsole(['error'], async () => {
      const view = await render(<StorySelectionScreen />);
      await view.findByTestId('fav-story-1');
      await fireEvent.press(view.getByTestId('fav-story-1'));
      await waitFor(() =>
        expect(mockUpdateFavorite).toHaveBeenCalledWith('user-1', 'story-1', true),
      );
      expect(mockUpdateStoryFavoriteStatus).toHaveBeenCalledWith('story-1', true);

      mockUpdateFavorite.mockRejectedValueOnce(new Error('boom'));
      await fireEvent.press(view.getByTestId('fav-story-1'));
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_update_favorite_status'),
      );
    });
  });

  it('ignores favorite toggles without a user', async () => {
    await withSilencedConsole(['error'], async () => {
      mockUserSettings.userId = null;
      const view = await render(<StorySelectionScreen />);
      await view.findByTestId('fav-story-1');
      await fireEvent.press(view.getByTestId('fav-story-1'));
      expect(mockUpdateFavorite).not.toHaveBeenCalled();
    });
  });

  it('exits only on a double back press', async () => {
    const view = await render(<StorySelectionScreen />);
    await view.findByTestId('story-story-1');
    expect(mockBackHandler.current).not.toBeNull();

    expect(mockBackHandler.current?.()).toBe(true);
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith('press_back_again_to_exit', 'info');

    expect(mockBackHandler.current?.()).toBe(true);
    expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
  });
});
