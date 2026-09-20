import { cleanup, fireEvent, render } from '@testing-library/react-native';
import RouteDetailScreen from '../../../src/screens/routes/RouteDetailScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockOpenEntity = jest.fn();
let mockRouteParams: any = { routeId: 'route-1' };
let mockStory: any = null;
let mockRoutesData: any = null;
let mockCanEdit = true;

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

jest.mock('../../../src/hooks/useStoryRole', () => ({
  useStoryRole: () => ({
    role: 'owner',
    canEdit: mockCanEdit,
    canManageStoryPolicy: true,
    loading: false,
  }),
}));

jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockOpenEntity,
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));

function routesData(overrides: any = {}) {
  const steps = [
    { id: 'step-1', sceneId: 'scene-1', selectedChoiceId: 'choice-1', position: 1 },
    { id: 'step-2', sceneId: 'scene-2', selectedChoiceId: null, position: 2 },
  ];
  return {
    routes: [{ id: 'route-1', name: 'North Path', details: 'Cold road' }],
    scenes: [
      { id: 'scene-1', name: 'Gate' },
      { id: 'scene-2', name: 'Pass' },
    ],
    choices: [],
    chapters: [],
    stepsOf: () => steps,
    sceneById: (id: string) =>
      (({ scene1: undefined }) as any)[id] ?? ({ id, name: `Scene ${id}` } as any),
    chapterNameOf: () => undefined,
    choicesFrom: () => [],
    validationOf: () => [],
    executionValidationOf: () => ({ valid: true, issues: [] }),
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('RouteDetailScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = { routeId: 'route-1' };
    mockStory = { id: 'story-1', type: 'branching', title: 'Story' };
    mockCanEdit = true;
    mockRoutesData = routesData();
  });

  it('shows loading state', async () => {
    mockRoutesData = routesData({ loading: true });
    const view = await render(<RouteDetailScreen />);
    expect(view.getByText('loading_routes')).toBeTruthy();
  });

  it('shows not found for an unknown route', async () => {
    mockRouteParams = { routeId: 'missing' };
    const view = await render(<RouteDetailScreen />);
    expect(view.getByText('route_not_found')).toBeTruthy();
  });

  it('renders steps and opens scenes', async () => {
    const view = await render(<RouteDetailScreen />);
    expect(view.getByText('North Path')).toBeTruthy();
    expect(view.getByText('Cold road')).toBeTruthy();
    expect(view.getByText('route_step_count')).toBeTruthy();
    expect(view.getByText('route_choice_selected')).toBeTruthy();
    expect(view.getByText('route_ends_here')).toBeTruthy();
    await fireEvent.press(view.getByText(/Scene scene-1/));
    expect(mockOpenEntity).toHaveBeenCalledWith(
      'Scene',
      'scene-1',
      expect.objectContaining({ onReturn: expect.any(Function) }),
    );
  });

  it('shows validation and unavailable-choice issues', async () => {
    mockRoutesData = routesData({
      validationOf: () => ['broken-link'],
      executionValidationOf: () => ({
        valid: false,
        issues: [{ kind: 'choice_unavailable', stepId: 'step-1' }],
      }),
    });
    const view = await render(<RouteDetailScreen />);
    expect(view.getByText('route_invalid_detail')).toBeTruthy();
    expect(view.getByText('route_choice_no_longer_available')).toBeTruthy();
  });

  it('shows the empty steps message without steps', async () => {
    mockRoutesData = routesData({ stepsOf: () => [] });
    const view = await render(<RouteDetailScreen />);
    expect(view.getByText('no_route_steps')).toBeTruthy();
  });

  it('navigates to steps editor and timeline', async () => {
    const view = await render(<RouteDetailScreen />);
    await fireEvent.press(view.getByText('edit_route_steps'));
    expect(mockNavigate).toHaveBeenCalledWith('RouteSteps', { routeId: 'route-1' });
    await fireEvent.press(view.getByText('route_timeline'));
    expect(mockNavigate).toHaveBeenCalledWith('RouteTimeline', { routeId: 'route-1' });
  });

  it('hides the edit button for readers', async () => {
    mockCanEdit = false;
    const view = await render(<RouteDetailScreen />);
    expect(view.queryByText('edit_route_steps')).toBeNull();
    expect(view.getByText('route_timeline')).toBeTruthy();
  });
});
