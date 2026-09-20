import { cleanup, fireEvent, render } from '@testing-library/react-native';
import RouteReaderScreen from '../../../src/screens/routes/RouteReaderScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockOpenEntity = jest.fn();
let mockRouteParams: any = { routeId: 'route-1' };
let mockStory: any = null;
let mockRoutesData: any = null;

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

jest.mock('../../../src/hooks/useStoryRoutes', () => ({
  useStoryRoutes: () => mockRoutesData,
}));

jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockOpenEntity,
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));

function routesData(overrides: any = {}) {
  const scenes: Record<string, any> = {
    'scene-1': { id: 'scene-1', name: 'Gate', summary: 'It begins at the gate.' },
    'scene-2': { id: 'scene-2', name: 'Pass', summary: null },
  };
  return {
    routes: [{ id: 'route-1', name: 'North Path', details: null }],
    scenes: Object.values(scenes),
    choices: [],
    chapters: [],
    stepsOf: () => [
      { id: 'step-1', sceneId: 'scene-1', selectedChoiceId: 'choice-1', position: 1 },
      { id: 'step-2', sceneId: 'scene-2', selectedChoiceId: null, position: 2 },
    ],
    sceneById: (id: string) => scenes[id],
    chapterNameOf: () => undefined,
    choicesFrom: () => [],
    validationOf: () => [],
    executionValidationOf: () => ({ valid: true, issues: [] }),
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('RouteReaderScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = { routeId: 'route-1' };
    mockStory = { id: 'story-1', type: 'branching', title: 'Story' };
    mockRoutesData = routesData();
  });

  it('shows loading state', async () => {
    mockRoutesData = routesData({ loading: true });
    const view = await render(<RouteReaderScreen />);
    expect(view.getByText('loading_routes')).toBeTruthy();
  });

  it('shows not found for an unknown route', async () => {
    mockRouteParams = { routeId: 'missing' };
    const view = await render(<RouteReaderScreen />);
    expect(view.getByText('route_not_found')).toBeTruthy();
  });

  it('refuses to read an invalid route', async () => {
    mockRoutesData = routesData({
      executionValidationOf: () => ({ valid: false, issues: [{ kind: 'broken_link' }] }),
    });
    const view = await render(<RouteReaderScreen />);
    expect(view.getByText('route_cannot_read_invalid')).toBeTruthy();
  });

  it('names unavailable choices distinctly', async () => {
    mockRoutesData = routesData({
      executionValidationOf: () => ({
        valid: false,
        issues: [{ kind: 'choice_unavailable', stepId: 'step-1' }],
      }),
    });
    const view = await render(<RouteReaderScreen />);
    expect(view.getByText('route_cannot_read_unavailable')).toBeTruthy();
  });

  it('reads scenes in order and opens their detail', async () => {
    const view = await render(<RouteReaderScreen />);
    expect(view.getByText('North Path')).toBeTruthy();
    expect(view.getByText('route_reader_scope')).toBeTruthy();
    expect(view.getByText('1. Gate')).toBeTruthy();
    expect(view.getByText('It begins at the gate.')).toBeTruthy();
    expect(view.getByText('2. Pass')).toBeTruthy();
    expect(view.getByText('plot_reader_no_summary')).toBeTruthy();
    await fireEvent.press(view.getByText('1. Gate'));
    expect(mockOpenEntity).toHaveBeenCalledWith(
      'Scene',
      'scene-1',
      expect.objectContaining({ onReturn: expect.any(Function) }),
    );
  });

  it('falls back to unknown scene without scene data', async () => {
    mockRoutesData = routesData({ sceneById: () => undefined });
    const view = await render(<RouteReaderScreen />);
    expect(view.getAllByText(/unknown_scene/).length).toBe(2);
  });
});
