import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import StoryNavigatorScreen from '../../../src/screens/routes/StoryNavigatorScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockOpenEntity = jest.fn();
const mockAlert = jest.fn();
const mockSaveRoute = jest.fn();
const mockReplaceSteps = jest.fn();
let mockStory: any = null;
let mockNavigatorData: any = null;
let mockRoutesData: any = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

jest.mock('../../../src/theme', () => ({
  useTheme: () => ({
    isDarkMode: false,
    colors: {
      background: '#fff',
      surface: '#fff',
      card: '#fff',
      text: '#111',
      textSecondary: '#555',
      border: '#ddd',
      primary: '#00f',
      primaryContainer: '#ddf',
      onPrimaryContainer: '#001',
      secondary: '#0a0',
      accent: '#a0a',
      error: '#f00',
    },
  }),
}));

jest.mock('../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => null,
    SingleSelectPill: ({ options, value, onValueChange }: any) => (
      <>
        <Text testID="single-value">{value ?? 'none'}</Text>
        {(options ?? []).map((o: any) => (
          <Text key={o.value} onPress={() => onValueChange(o.value)}>
            {o.label}
          </Text>
        ))}
      </>
    ),
  };
});

jest.mock('../../../src/components/features/routes/NavigatorRoutePersistenceModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ mode, onClose, onConfirm }: any) => (
      <>
        <Text testID="persist-mode">{mode}</Text>
        <Text testID="persist-close" onPress={onClose}>
          close
        </Text>
        <Text testID="persist-new" onPress={() => onConfirm({ name: 'Saved Run' })}>
          save-new
        </Text>
        <Text testID="persist-replace" onPress={() => onConfirm({ routeId: 'route-1' })}>
          save-replace
        </Text>
      </>
    ),
  };
});

jest.mock('../../../src/state/storyStore', () => ({
  useStoryStore: (selector?: (s: any) => any) => {
    const state = {
      selectedStory: mockStory,
      setSelectedStory: jest.fn(),
      activeArcId: null,
      setActiveArcId: jest.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (s: any) => any) => {
    const state = { userId: 'user-1', exportFormat: 'svg' };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/hooks/useStoryNavigatorData', () => ({
  useStoryNavigatorData: () => mockNavigatorData,
}));

jest.mock('../../../src/hooks/useStoryRoutes', () => ({
  useStoryRoutes: () => mockRoutesData,
}));

jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockOpenEntity,
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));
jest.mock('../../../src/db', () => ({ useDrizzle: () => ({}) }));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...a: any[]) => mockAlert(...a) },
}));
jest.mock('../../../src/services/storymanagement/RouteService', () => ({
  createRouteService: () => ({ save: mockSaveRoute, replaceSteps: mockReplaceSteps }),
}));

const scenes = [
  { id: 'scene-1', name: 'Gate', summary: 'It begins.', isStart: true },
  { id: 'scene-2', name: 'Pass', summary: null, isStart: false },
];
const choices = [{ id: 'choice-1', sceneId: 'scene-1', nextSceneId: 'scene-2', text: 'Go north' }];

function navigatorData(overrides: any = {}) {
  return {
    scenes,
    choices,
    items: [],
    groups: [],
    checks: [],
    effects: [],
    loading: false,
    ...overrides,
  };
}

function routesData(overrides: any = {}) {
  return {
    routes: [{ id: 'route-1', name: 'Old Run', details: null }],
    scenes,
    choices,
    chapters: [],
    stepsOf: () => [],
    sceneById: (id: string) => scenes.find((s) => s.id === id),
    chapterNameOf: () => undefined,
    choicesFrom: (sceneId: string) => choices.filter((c) => c.sceneId === sceneId),
    validationOf: () => [],
    executionValidationOf: () => ({ valid: true, issues: [] }),
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('StoryNavigatorScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockStory = { id: 'story-1', type: 'branching', title: 'Story' };
    mockNavigatorData = navigatorData();
    mockRoutesData = routesData();
    mockSaveRoute.mockResolvedValue({ id: 'route-9', name: 'Saved Run' });
    mockReplaceSteps.mockResolvedValue(undefined);
  });

  it('rejects non-branching stories', async () => {
    mockStory = { id: 'story-1', type: 'linear', title: 'Story' };
    const view = await render(<StoryNavigatorScreen />);
    expect(view.getByText('navigator_branching_only')).toBeTruthy();
  });

  it('shows loading state', async () => {
    mockNavigatorData = navigatorData({ loading: true });
    const view = await render(<StoryNavigatorScreen />);
    expect(view.getByText('loading_story_navigator')).toBeTruthy();
  });

  it('enters the start scene and chooses a path', async () => {
    const view = await render(<StoryNavigatorScreen />);
    expect(view.getByTestId('single-value').props.children).toBe('scene-1');
    expect(view.getAllByText('Gate').length).toBe(2);
    expect(view.getByText('It begins.')).toBeTruthy();
    expect(view.getByText('Go north')).toBeTruthy();
    await fireEvent.press(view.getByText('Go north'));
    expect(view.getAllByText('Pass').length).toBe(2);
    expect(view.getByText('plot_reader_no_summary')).toBeTruthy();
    expect(view.getByText('navigator_no_choices')).toBeTruthy();
  });

  it('restarts the traversal', async () => {
    const view = await render(<StoryNavigatorScreen />);
    await fireEvent.press(view.getByText('Go north'));
    expect(view.getAllByText('Pass').length).toBe(2);
    await fireEvent.press(view.getByText('navigator_restart'));
    expect(view.getAllByText('Gate').length).toBe(2);
  });

  it('changes the start scene', async () => {
    const view = await render(<StoryNavigatorScreen />);
    await fireEvent.press(view.getAllByText('Pass')[0]);
    expect(view.getByTestId('single-value').props.children).toBe('scene-2');
  });

  it('opens the current scene detail', async () => {
    const view = await render(<StoryNavigatorScreen />);
    await fireEvent.press(view.getAllByText('Gate')[1]);
    expect(mockOpenEntity).toHaveBeenCalledWith(
      'Scene',
      'scene-1',
      expect.objectContaining({ onReturn: expect.any(Function) }),
    );
  });

  it('explains unavailable choices', async () => {
    mockNavigatorData = navigatorData({
      groups: [{ id: 'g1', choiceId: 'choice-1', combinator: 'AND', isDeleted: false, order: 0 }],
      checks: [
        {
          id: 'c1',
          groupId: 'g1',
          order: 0,
          mode: 'require',
          type: 'trigger',
          triggerName: 'torch',
          triggerState: 'set',
          isDeleted: false,
        },
      ],
    });
    const view = await render(<StoryNavigatorScreen />);
    expect(view.getByText('navigator_requires_trigger')).toBeTruthy();
  });

  it('saves the traversal as a new route', async () => {
    const view = await render(<StoryNavigatorScreen />);
    await fireEvent.press(view.getByText('navigator_save_as_route'));
    expect(view.getByTestId('persist-mode').props.children).toBe('new');
    await fireEvent.press(view.getByTestId('persist-new'));
    expect(mockAlert).toHaveBeenCalledWith(
      'navigator_save_route_confirm_title',
      'navigator_save_route_confirm_message',
      expect.any(Array),
      expect.any(Object),
    );
    await mockAlert.mock.calls[0][2][1].onPress();
    expect(mockSaveRoute).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ storyId: 'story-1', name: 'Saved Run' }),
    );
    expect(mockReplaceSteps).toHaveBeenCalledWith('user-1', 'route-9', [
      { sceneId: 'scene-1', selectedChoiceId: null },
    ]);
    expect(mockNavigate).toHaveBeenCalledWith('RouteDetail', { routeId: 'route-9' });
  });

  it('replaces an existing route', async () => {
    const view = await render(<StoryNavigatorScreen />);
    await fireEvent.press(view.getByText('navigator_replace_route'));
    expect(view.getByTestId('persist-mode').props.children).toBe('replace');
    await fireEvent.press(view.getByTestId('persist-replace'));
    await mockAlert.mock.calls[0][2][1].onPress();
    expect(mockSaveRoute).not.toHaveBeenCalled();
    expect(mockReplaceSteps).toHaveBeenCalledWith('user-1', 'route-1', expect.any(Array));
    expect(mockNavigate).toHaveBeenCalledWith('RouteDetail', { routeId: 'route-1' });
  });

  it('alerts when persisting fails', async () => {
    await withSilencedConsole(['error'], async () => {
      mockSaveRoute.mockRejectedValue(new Error('boom'));
      const view = await render(<StoryNavigatorScreen />);
      await fireEvent.press(view.getByText('navigator_save_as_route'));
      await fireEvent.press(view.getByTestId('persist-new'));
      await mockAlert.mock.calls[0][2][1].onPress();
      expect(mockAlert).toHaveBeenCalledWith('error', 'navigator_save_route_failed');
    });
  });
});
