import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import RouteStepsScreen from '../../../src/screens/routes/RouteStepsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockAlert = jest.fn();
const mockReplaceSteps = jest.fn();
let mockRouteParams: any = { routeId: 'route-1' };
let mockStory: any = null;
let mockRoutesData: any = null;
let mockUserId: string | null = 'user-1';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
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
    const state = { userId: mockUserId, exportFormat: 'svg' };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/hooks/useStoryRoutes', () => ({
  useStoryRoutes: () => mockRoutesData,
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/db', () => ({ useDrizzle: () => ({}) }));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...a: any[]) => mockAlert(...a) },
}));
jest.mock('../../../src/services/storymanagement/RouteService', () => ({
  createRouteService: () => ({ replaceSteps: mockReplaceSteps }),
}));

const scenes = [
  { id: 'scene-1', name: 'Gate', chapterId: 'chapter-1' },
  { id: 'scene-2', name: 'Pass', chapterId: null },
];
const choices = [{ id: 'choice-1', sceneId: 'scene-1', nextSceneId: 'scene-2', text: 'Go north' }];

function routesData(overrides: any = {}) {
  return {
    routes: [{ id: 'route-1', name: 'North Path', details: null }],
    scenes,
    choices,
    chapters: [{ id: 'chapter-1', name: 'Arrival' }],
    stepsOf: () => [],
    sceneById: (id: string) => scenes.find((s) => s.id === id),
    chapterNameOf: (id: string | null) => (id === 'chapter-1' ? 'Arrival' : undefined),
    choicesFrom: (sceneId: string) => choices.filter((c) => c.sceneId === sceneId),
    validationOf: () => [],
    executionValidationOf: () => ({ valid: true, issues: [] }),
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('RouteStepsScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = { routeId: 'route-1' };
    mockStory = { id: 'story-1', type: 'branching', title: 'Story' };
    mockUserId = 'user-1';
    mockRoutesData = routesData();
    mockReplaceSteps.mockResolvedValue(undefined);
  });

  it('renders nothing while loading', async () => {
    mockRoutesData = routesData({ loading: true });
    const view = await render(<RouteStepsScreen />);
    expect(view.toJSON()).toBeNull();
  });

  it('renders nothing without the route', async () => {
    mockRouteParams = { routeId: 'missing' };
    mockRoutesData = routesData();
    const view = await render(<RouteStepsScreen />);
    expect(view.toJSON()).toBeNull();
  });

  it('starts from a chosen start scene', async () => {
    const view = await render(<RouteStepsScreen />);
    expect(view.getByText('route_steps_guided_help')).toBeTruthy();
    expect(view.getByText('route_start_scene')).toBeTruthy();
    await fireEvent.press(view.getByText('Gate · Arrival'));
    expect(view.getByText('route_step_number')).toBeTruthy();
    expect(view.getByText('Gate · Arrival')).toBeTruthy();
  });

  it('extends the route through a choice and saves', async () => {
    const view = await render(<RouteStepsScreen />);
    await fireEvent.press(view.getByText('Gate · Arrival'));
    await fireEvent.press(view.getByText('Go north'));
    expect(view.getAllByText('route_step_number').length).toBe(2);
    await fireEvent.press(view.getByText('save_changes'));
    expect(mockReplaceSteps).toHaveBeenCalledWith('user-1', 'route-1', [
      { sceneId: 'scene-1', selectedChoiceId: 'choice-1' },
      { sceneId: 'scene-2', selectedChoiceId: null },
    ]);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('ends the route at the end-here option', async () => {
    const view = await render(<RouteStepsScreen />);
    await fireEvent.press(view.getByText('Gate · Arrival'));
    await fireEvent.press(view.getByText('route_end_here_option'));
    expect(view.getAllByText('route_step_number').length).toBe(1);
    await fireEvent.press(view.getByText('save_changes'));
    expect(mockReplaceSteps).toHaveBeenCalledWith('user-1', 'route-1', [
      { sceneId: 'scene-1', selectedChoiceId: null },
    ]);
  });

  it('hydrates existing steps and drops the last one', async () => {
    mockRoutesData = routesData({
      stepsOf: () => [
        { id: 's1', sceneId: 'scene-1', selectedChoiceId: null },
        { id: 's2', sceneId: 'scene-2', selectedChoiceId: null },
      ],
    });
    const view = await render(<RouteStepsScreen />);
    expect(view.getAllByText('route_step_number').length).toBe(2);
    expect(view.getByText('route_no_available_choices')).toBeTruthy();
    await fireEvent.press(view.getByText('route_change_start'));
    expect(view.getAllByText('route_step_number').length).toBe(1);
  });

  it('alerts when saving fails', async () => {
    mockReplaceSteps.mockRejectedValue(new Error('boom'));
    mockRoutesData = routesData({
      stepsOf: () => [{ id: 's1', sceneId: 'scene-1', selectedChoiceId: null }],
    });
    const view = await render(<RouteStepsScreen />);
    await fireEvent.press(view.getByText('save_changes'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'boom');
  });

  it('does nothing without a user', async () => {
    mockUserId = null;
    mockRoutesData = routesData({
      stepsOf: () => [{ id: 's1', sceneId: 'scene-1', selectedChoiceId: null }],
    });
    const view = await render(<RouteStepsScreen />);
    await fireEvent.press(view.getByText('save_changes'));
    expect(mockReplaceSteps).not.toHaveBeenCalled();
  });
});
