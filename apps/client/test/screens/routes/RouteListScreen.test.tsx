import { cleanup, fireEvent, render } from '@testing-library/react-native';
import RouteListScreen from '../../../src/screens/routes/RouteListScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockStory: any = null;
let mockRoutesData: any = null;
let mockCanEdit = true;

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

jest.mock('../../../src/hooks/useStoryRole', () => ({
  useStoryRole: () => ({
    role: 'owner',
    canEdit: mockCanEdit,
    canManageStoryPolicy: true,
    loading: false,
  }),
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));

function routesData(overrides: any = {}) {
  return {
    routes: [],
    scenes: [],
    choices: [],
    chapters: [],
    stepsOf: () => [],
    sceneById: () => undefined,
    chapterNameOf: () => undefined,
    choicesFrom: () => [],
    validationOf: () => [],
    executionValidationOf: () => ({ valid: true, issues: [] }),
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('RouteListScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockStory = { id: 'story-1', type: 'branching', title: 'Story' };
    mockCanEdit = true;
    mockRoutesData = routesData();
  });

  it('asks for a story when none is selected', async () => {
    mockStory = null;
    const view = await render(<RouteListScreen />);
    expect(view.getByText('no_story_selected')).toBeTruthy();
  });

  it('rejects non-branching stories', async () => {
    mockStory = { id: 'story-1', type: 'linear', title: 'Story' };
    const view = await render(<RouteListScreen />);
    expect(view.getByText('routes_branching_only')).toBeTruthy();
  });

  it('shows loading state', async () => {
    mockRoutesData = routesData({ loading: true });
    const view = await render(<RouteListScreen />);
    expect(view.getByText('loading_routes')).toBeTruthy();
  });

  it('shows the empty state without routes', async () => {
    const view = await render(<RouteListScreen />);
    expect(view.getByText('no_routes')).toBeTruthy();
  });

  it('lists routes with step counts and opens the detail', async () => {
    mockRoutesData = routesData({
      routes: [
        { id: 'route-1', name: 'North Path', details: 'Cold road' },
        { id: 'route-2', name: 'South Path', details: null },
      ],
      stepsOf: (id: string) => (id === 'route-1' ? [{ id: 's1' }, { id: 's2' }] : []),
    });
    const view = await render(<RouteListScreen />);
    expect(view.getByText('North Path')).toBeTruthy();
    expect(view.getByText('South Path')).toBeTruthy();
    expect(view.getByText('Cold road')).toBeTruthy();
    expect(view.getAllByText('route_step_count').length).toBe(2);
    await fireEvent.press(view.getByText('North Path'));
    expect(mockNavigate).toHaveBeenCalledWith('RouteDetail', { routeId: 'route-1' });
  });
});
