import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { useUserSettingsStore } from '../../../src/state/userSettingsStore';

const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
const mockParentDispatch = jest.fn();
const mockShowNotification = jest.fn();
const mockGetContentCounts = jest.fn();
const mockAnalyzeStoryCheap = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockUseScreenTour = jest.fn();
const mockUpdateClientSettings = jest.fn();

let mockSelectedStory: { id: string; title: string } | null = {
  id: 'story-1',
  title: 'My Story',
};
let mockConflicts: { id: string }[] = [];

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const react = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    __esModule: true,
    useNavigation: () => ({
      navigate: mockNavigate,
      dispatch: mockDispatch,
      getParent: () => ({ dispatch: mockParentDispatch }),
    }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../../src/services/ClientSettingsService', () => ({
  __esModule: true,
  getClientSettings: jest.fn(),
  updateClientSettings: (...args: unknown[]) => mockUpdateClientSettings(...args),
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => mockUseScreenHeader(config),
}));
jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('../../../src/services/storymanagement/StoryContentMetricsService', () => ({
  __esModule: true,
  createStoryContentMetricsService: () => ({ getContentCounts: mockGetContentCounts }),
}));
jest.mock('../../../src/services/storymanagement/StoryAnalysisService', () => ({
  __esModule: true,
  createStoryAnalysisService: () => ({ analyzeStoryCheap: mockAnalyzeStoryCheap }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockShowNotification }),
}));
jest.mock('../../../src/state/syncConflictStore', () => ({
  __esModule: true,
  useSyncConflictStore: (selector: (state: { conflicts: { id: string }[] }) => unknown) =>
    selector({ conflicts: mockConflicts }),
}));
jest.mock('../../../src/screens/mainstorystack/MainDashboardContent', () => ({
  __esModule: true,
  MainDashboardContent: (props: {
    story: { id: string } | null;
    conflictCount: number;
    conflictSheetOpen: boolean;
    onOpenConflictSheet: () => void;
    onCloseConflictSheet: () => void;
    characterCount?: number;
    analysisIssueCount?: number;
    forkCount?: number;
    onOpenAnalysis: () => void;
    onOpenOperationLog: () => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      null,
      react.createElement(
        native.Text,
        { testID: 'dashboard-marker' },
        JSON.stringify({
          storyId: props.story?.id ?? null,
          conflicts: props.conflictCount,
          sheetOpen: props.conflictSheetOpen,
          characters: props.characterCount ?? null,
          analysis: props.analysisIssueCount ?? null,
          forks: props.forkCount ?? null,
        }),
      ),
      react.createElement(
        native.Text,
        { testID: 'open-sheet', onPress: props.onOpenConflictSheet },
        'open',
      ),
      react.createElement(
        native.Text,
        { testID: 'close-sheet', onPress: props.onCloseConflictSheet },
        'close',
      ),
      react.createElement(
        native.Text,
        { testID: 'open-analysis', onPress: props.onOpenAnalysis },
        'analysis',
      ),
      react.createElement(
        native.Text,
        { testID: 'open-oplog', onPress: props.onOpenOperationLog },
        'oplog',
      ),
    );
  },
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));

import MainDashboardScreen from '../../../src/screens/mainstorystack/MainDashboardScreen';

const fullCounts = {
  characterCount: 3,
  locationCount: 2,
  chapterCount: 4,
  sceneCount: 10,
  choiceCount: 5,
  noteCount: 6,
  worldRuleCount: 1,
  itemCount: 7,
  galleryCount: 8,
  tagCount: 9,
  customAttributeCount: 11,
  branchingStoryForkCount: 2,
};

function jsonOf(view: { getByTestId: (id: string) => { props: { children?: unknown } } }) {
  return JSON.parse(view.getByTestId('dashboard-marker').props.children as string);
}

describe('MainDashboardScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedStory = { id: 'story-1', title: 'My Story' };
    mockConflicts = [{ id: 'c-1' }, { id: 'c-2' }];
    mockGetContentCounts.mockResolvedValue(fullCounts);
    mockAnalyzeStoryCheap.mockResolvedValue({ findings: [{ id: 'f-1' }, { id: 'f-2' }] });
  });

  it('requests its guided tour', async () => {
    await render(<MainDashboardScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('MainDashboard');
  });

  it('completes the first-story trail on arrival and celebrates once', async () => {
    useUserSettingsStore.setState({
      tutorialProgress: {
        version: 1,
        seen: [],
        firstStory: { choice: 'create', done: false, dismissed: false },
      },
    });
    mockUpdateClientSettings.mockImplementation(
      async (_db: unknown, patch: Record<string, unknown>) => {
        useUserSettingsStore.setState({
          tutorialProgress: JSON.parse(patch.seenTutorials as string),
        });
        return undefined;
      },
    );
    try {
      await render(<MainDashboardScreen />);

      await waitFor(() =>
        expect(mockShowNotification).toHaveBeenCalledWith('first_story_success', 'success'),
      );
      const [, written] = mockUpdateClientSettings.mock.calls[0];
      expect(JSON.parse(written.seenTutorials).firstStory.done).toBe(true);
      // The persisted done flag keeps later focuses quiet.
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
    } finally {
      useUserSettingsStore.getState().resetSettings();
    }
  });

  it('fetches counts and analysis issues into the dashboard content', async () => {
    const view = await render(<MainDashboardScreen />);
    await waitFor(() => expect(mockGetContentCounts).toHaveBeenCalledWith('story-1'));
    await waitFor(() => expect(mockAnalyzeStoryCheap).toHaveBeenCalledWith('story-1'));
    expect(jsonOf(view)).toMatchObject({
      storyId: 'story-1',
      conflicts: 2,
      characters: 3,
      analysis: 2,
      forks: 2,
    });
  });

  it('opens and closes the conflict sheet', async () => {
    const view = await render(<MainDashboardScreen />);
    expect(jsonOf(view).sheetOpen).toBe(false);
    await fireEvent.press(view.getByTestId('open-sheet'));
    expect(jsonOf(view).sheetOpen).toBe(true);
    await fireEvent.press(view.getByTestId('close-sheet'));
    expect(jsonOf(view).sheetOpen).toBe(false);
  });

  it('navigates to analysis, operation log and settings', async () => {
    const view = await render(<MainDashboardScreen />);
    await fireEvent.press(view.getByTestId('open-analysis'));
    expect(mockNavigate).toHaveBeenCalledWith('StoryAnalysis', { storyId: 'story-1' });
    await fireEvent.press(view.getByTestId('open-oplog'));
    expect(mockNavigate).toHaveBeenCalledWith('OperationLogStack', { screen: 'OperationLog' });
    const headerCall = mockUseScreenHeader.mock.calls[0][0] as {
      title: string;
      actions: { onPress: () => void }[];
    };
    expect(headerCall.title).toBe('My Story');
    headerCall.actions[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('StorySettings', { storyId: 'story-1' });
  });

  it('warns when opening settings without a story', async () => {
    mockSelectedStory = null;
    await render(<MainDashboardScreen />);
    const headerCall = mockUseScreenHeader.mock.calls[0][0] as {
      title: string;
      actions: { onPress: () => void }[];
    };
    expect(headerCall.title).toBe('dashboard_title');
    headerCall.actions[0].onPress();
    expect(mockShowNotification).toHaveBeenCalledWith('no_story_selected_for_settings', 'warning');
    expect(mockGetContentCounts).not.toHaveBeenCalled();
    expect(mockAnalyzeStoryCheap).not.toHaveBeenCalled();
  });

  it('exits to story selection on a double back press', async () => {
    let backAction: (() => boolean) | null = null;
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
      ...args: unknown[]
    ) => {
      backAction = args[1] as () => boolean;
      return { remove: jest.fn() };
    }) as never);
    try {
      await render(<MainDashboardScreen />);
      expect(backAction).not.toBeNull();
      expect(backAction!()).toBe(true);
      expect(mockShowNotification).toHaveBeenCalledWith('press_back_again_to_exit', 'info');
      expect(backAction!()).toBe(true);
      expect(mockParentDispatch).toHaveBeenCalledTimes(1);
      expect(mockParentDispatch.mock.calls[0][0]).toMatchObject({
        type: 'RESET',
        payload: { index: 0, routes: [{ name: 'StorySelection' }] },
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps the dashboard usable when metrics fail', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetContentCounts.mockRejectedValue(new Error('metrics down'));
    mockAnalyzeStoryCheap.mockRejectedValue(new Error('analysis down'));
    try {
      const view = await render(<MainDashboardScreen />);
      await waitFor(() => expect(mockGetContentCounts).toHaveBeenCalled());
      await waitFor(() => expect(mockAnalyzeStoryCheap).toHaveBeenCalled());
      expect(jsonOf(view)).toMatchObject({ storyId: 'story-1', characters: null, analysis: null });
    } finally {
      errorSpy.mockRestore();
    }
  });
});
