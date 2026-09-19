import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockGoBack = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockSetSelectedStory = jest.fn();
const mockAppAlert = jest.fn();
const mockAnalyzeStoryCheap = jest.fn();
const mockAnalyzeStoryFull = jest.fn();
const mockNormalizeIndexes = jest.fn();
const mockUpdateStory = jest.fn();
const mockNavigateToEntityDetail = jest.fn();
const mockUseScreenTour = jest.fn();

let mockSelectedStory: {
  id: string;
  type: string;
  completenessChecks: boolean;
} | null = { id: 'story-1', type: 'branching', completenessChecks: false };
let mockCanEdit = true;

const mockNavigation = { goBack: mockGoBack, navigate: jest.fn() };
const mockT = ((key: string) => key) as (key: string) => string;
const mockDrizzleDb = {};
const mockColors = {
  primary: '#0000ff',
  primaryContainer: '#eeeeff',
  onPrimary: '#ffffff',
  background: '#ffffff',
  surface: '#f5f5f5',
  onSurface: '#111111',
  card: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  border: '#dddddd',
  error: '#ff0000',
  success: '#00aa00',
  warning: '#ffaa00',
  info: '#0000ff',
};

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => mockNavigation,
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDrizzleDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => mockUseScreenHeader(config),
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('../../../src/services/storymanagement/StoryAnalysisService', () => ({
  __esModule: true,
  createStoryAnalysisService: () => ({
    analyzeStoryCheap: mockAnalyzeStoryCheap,
    analyzeStoryFull: mockAnalyzeStoryFull,
  }),
}));
jest.mock('../../../src/services/storymanagement/StoryIndexService', () => ({
  __esModule: true,
  createStoryIndexService: () => ({ normalizeIndexes: mockNormalizeIndexes }),
}));
jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: () => ({ updateStory: mockUpdateStory }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({
    selectedStory: mockSelectedStory,
    setSelectedStory: mockSetSelectedStory,
  }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: mockColors }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAppAlert(...args) },
}));
jest.mock('../../../src/utils/entityNavigation', () => ({
  __esModule: true,
  navigateToEntityDetail: (...args: unknown[]) => mockNavigateToEntityDetail(...args),
}));
jest.mock('../../../src/utils/storyAnalysisChecks', () => ({
  __esModule: true,
  StoryAnalysisCancelledError: class StoryAnalysisCancelledError extends Error {},
}));
jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
  }),
}));
jest.mock('../../../src/components/common/controls/Button/Button', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      onPress,
      disabled,
      children,
      testID,
    }: {
      onPress: () => void;
      disabled?: boolean;
      children?: ReactNode;
      testID?: string;
    }) => (
      <Text testID={testID ?? `btn-${children}`} onPress={disabled ? undefined : onPress}>
        {`${children}:${disabled ? 'disabled' : 'enabled'}`}
      </Text>
    ),
  };
});
jest.mock('../../../src/components/common/display/CollapsibleCard/CollapsibleCard', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, children }: { title: string; children?: ReactNode }) => (
      <>
        <Text testID={`card-${title}`}>{title}</Text>
        {children}
      </>
    ),
  };
});
jest.mock('../../../src/components/common/controls/FormActions/FormActions', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children?: ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('../../../src/components/common/controls/ThemedSwitch/ThemedSwitch', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      value,
      onValueChange,
      disabled,
      testID,
    }: {
      value: boolean;
      onValueChange: (next: boolean) => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <Text
        testID={testID ?? 'themed-switch'}
        onPress={disabled ? undefined : () => onValueChange(!value)}
      >
        {`${value}:${disabled ? 'disabled' : 'enabled'}`}
      </Text>
    ),
  };
});
jest.mock('../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: ({ message }: { message?: string }) => (
      <Text testID="screen-loading">{message ?? 'loading'}</Text>
    ),
    ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => (
      <Text testID="screen-error" onPress={onGoBack}>
        {message}
      </Text>
    ),
  };
});
jest.mock('react-i18next', () => {
  const actual = jest.requireActual('react-i18next');
  return {
    ...actual,
    __esModule: true,
    useTranslation: () => ({ t: mockT }),
  };
});

import StoryAnalysisScreen from '../../../src/screens/mainstorystack/StoryAnalysisScreen';

const { StoryAnalysisCancelledError } = jest.requireMock(
  '../../../src/utils/storyAnalysisChecks',
) as { StoryAnalysisCancelledError: new (message: string) => Error };

function makeFinding(overrides = {}) {
  return {
    id: 'finding-1',
    category: 'scenes',
    severity: 'error',
    messageKey: 'analysis_scene_index_gap',
    messageParams: {},
    entityType: 'Scene',
    entityId: 'scene-1',
    entityName: 'Opening',
    ...overrides,
  };
}

describe('StoryAnalysisScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedStory = { id: 'story-1', type: 'branching', completenessChecks: false };
    mockCanEdit = true;
    mockAnalyzeStoryCheap.mockResolvedValue({ findings: [] });
    mockAnalyzeStoryFull.mockResolvedValue({ findings: [] });
    mockNormalizeIndexes.mockResolvedValue({ changed: 3 });
    mockUpdateStory.mockResolvedValue(undefined);
  });

  it('requests its guided tour', async () => {
    await render(<StoryAnalysisScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('StoryAnalysis');
  });

  it('loads the cheap report on focus and shows the empty state', async () => {
    // Linear stories treat the cheap report as the full one.
    mockSelectedStory = { id: 'story-1', type: 'linear', completenessChecks: false };
    const view = await render(<StoryAnalysisScreen />);
    await waitFor(() => expect(mockAnalyzeStoryCheap).toHaveBeenCalledWith('story-1'));
    await waitFor(() => expect(view.queryByText('analysis_no_issues_found')).not.toBeNull());
    expect(view.getByTestId('analysis-preferences')).toBeTruthy();
    expect(view.getByTestId('run-full-analysis').props.children).toBe(
      'story_analysis_run_button:enabled',
    );
  });

  it('groups findings by category and navigates to their entities', async () => {
    mockAnalyzeStoryCheap.mockResolvedValue({
      findings: [
        makeFinding(),
        makeFinding({
          id: 'finding-2',
          category: 'choices',
          severity: 'warning',
          messageKey: 'analysis_choice_dangling',
          entityId: null,
          entityName: null,
        }),
      ],
    });
    const view = await render(<StoryAnalysisScreen />);
    await waitFor(() => expect(view.queryByTestId('card-Scenes (1)')).not.toBeNull());
    expect(view.getByTestId('card-analysis_category_choices (1)')).toBeTruthy();
    expect(view.getByText('Opening')).toBeTruthy();
    await fireEvent.press(view.getByText('Opening'));
    expect(mockNavigateToEntityDetail).toHaveBeenCalledWith(mockNavigation, 'Scene', 'scene-1');
    // The dangling choice has no entity: its row is disabled.
    await fireEvent.press(view.getByText('analysis_choice_dangling'));
    expect(mockNavigateToEntityDetail).toHaveBeenCalledTimes(1);
  });

  it('runs the full analysis on demand', async () => {
    mockAnalyzeStoryFull.mockResolvedValue({ findings: [makeFinding({ id: 'finding-9' })] });
    const view = await render(<StoryAnalysisScreen />);
    await waitFor(() => expect(view.queryByTestId('run-full-analysis')).not.toBeNull());
    await fireEvent.press(view.getByTestId('run-full-analysis'));
    await waitFor(() => expect(mockAnalyzeStoryFull).toHaveBeenCalled());
    expect(mockAnalyzeStoryFull.mock.calls[0][0]).toBe('story-1');
    await waitFor(() => expect(view.queryByTestId('card-Scenes (1)')).not.toBeNull());
  });

  it('reports cancellation of the full analysis', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAnalyzeStoryCheap.mockResolvedValue({ findings: [makeFinding()] });
    mockAnalyzeStoryFull.mockRejectedValue(new StoryAnalysisCancelledError('cancelled'));
    try {
      const view = await render(<StoryAnalysisScreen />);
      await waitFor(() => expect(view.queryByTestId('run-full-analysis')).not.toBeNull());
      await fireEvent.press(view.getByTestId('run-full-analysis'));
      await waitFor(() => expect(view.queryByText('story_analysis_cancelled')).not.toBeNull());
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('normalizes indexes when index findings exist', async () => {
    mockAnalyzeStoryCheap.mockResolvedValue({ findings: [makeFinding()] });
    const view = await render(<StoryAnalysisScreen />);
    await waitFor(() => expect(view.queryByTestId('fix-indexes')).not.toBeNull());
    await fireEvent.press(view.getByTestId('fix-indexes'));
    await waitFor(() => expect(mockNormalizeIndexes).toHaveBeenCalledWith('user-1', 'story-1'));
    expect(mockAppAlert).toHaveBeenCalledWith('success', 'analysis_fix_indexes_done');
  });

  it('saves the completeness preference and resets it', async () => {
    const view = await render(<StoryAnalysisScreen />);
    await waitFor(() => expect(view.queryByTestId('completeness-checks-switch')).not.toBeNull());
    expect(view.getByTestId('completeness-checks-switch').props.children).toBe('false:enabled');
    expect(view.getByTestId('btn-confirm').props.children).toBe('confirm:disabled');
    await fireEvent.press(view.getByTestId('completeness-checks-switch'));
    expect(view.getByTestId('btn-confirm').props.children).toBe('confirm:enabled');
    // Reset first: the form returns to the stored preference.
    await fireEvent.press(view.getByTestId('btn-cancel'));
    expect(view.getByTestId('btn-confirm').props.children).toBe('confirm:disabled');
    await fireEvent.press(view.getByTestId('completeness-checks-switch'));
    await fireEvent.press(view.getByTestId('btn-confirm'));
    await waitFor(() =>
      expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', {
        completenessChecks: true,
      }),
    );
    expect(mockSetSelectedStory).toHaveBeenCalledWith({
      id: 'story-1',
      type: 'branching',
      completenessChecks: true,
    });
    expect(mockAppAlert).toHaveBeenCalledWith('success', 'story_updated_successfully');
  });

  it('shows the error state when the report cannot load', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockAnalyzeStoryCheap.mockRejectedValue(new Error('analysis down'));
    try {
      const view = await render(<StoryAnalysisScreen />);
      await waitFor(() => expect(view.queryByTestId('screen-error')).not.toBeNull());
      expect(view.getByTestId('screen-error').props.children).toBe('failed_to_load_analysis');
      await fireEvent.press(view.getByTestId('screen-error'));
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
