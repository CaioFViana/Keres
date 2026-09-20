import { cleanup, fireEvent, render } from '@testing-library/react-native';
import PlotReaderScreen from '../../../src/screens/plots/PlotReaderScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockOpenEntity = jest.fn();
let mockStory: any = null;
let mockPlotsData: any = null;

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

jest.mock('../../../src/hooks/useStoryPlots', () => ({
  useStoryPlots: () => mockPlotsData,
}));

jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockOpenEntity,
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));

function plotsData(overrides: any = {}) {
  const scenes = [
    { id: 'scene-1', name: 'Gate', summary: 'It begins.' },
    { id: 'scene-2', name: 'Pass', summary: null },
  ];
  const relations = [{ id: 'r1', plotId: 'plot-1', sceneId: 'scene-2', note: '' }];
  return {
    plots: [{ id: 'plot-1', name: 'Rebellion', details: null }],
    relations,
    scenes,
    chapters: [],
    choices: [],
    relationsOf: (plotId: string) => relations.filter((r) => r.plotId === plotId),
    sceneById: (id: string) => scenes.find((s) => s.id === id),
    chapterNameOf: () => undefined,
    plotById: (id: string) => (id === 'plot-1' ? { id: 'plot-1', name: 'Rebellion' } : undefined),
    coverageOf: () => ({ covered: 0, total: 0, percentage: 0 }),
    presentationOrder: 'chapters',
    layerOf: () => undefined,
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('PlotReaderScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockStory = { id: 'story-1', type: 'linear', title: 'Story' };
    mockPlotsData = plotsData();
  });

  it('rejects non-linear stories', async () => {
    mockStory = { id: 'story-1', type: 'branching', title: 'Story' };
    const view = await render(<PlotReaderScreen />);
    expect(view.getByText('plots_linear_only')).toBeTruthy();
  });

  it('shows loading state', async () => {
    mockPlotsData = plotsData({ loading: true });
    const view = await render(<PlotReaderScreen />);
    expect(view.getByText('loading_plots')).toBeTruthy();
  });

  it('reads all scenes by default and opens their detail', async () => {
    const view = await render(<PlotReaderScreen />);
    expect(view.getByText('plot_reader_scope')).toBeTruthy();
    expect(view.getByText('1. Gate')).toBeTruthy();
    expect(view.getByText('It begins.')).toBeTruthy();
    expect(view.getByText('2. Pass')).toBeTruthy();
    expect(view.getByText('plot_reader_no_summary')).toBeTruthy();
    await fireEvent.press(view.getByText('1. Gate'));
    expect(mockOpenEntity).toHaveBeenCalledWith(
      'Scene',
      'scene-1',
      expect.objectContaining({ onReturn: expect.any(Function) }),
    );
  });

  it('narrows the reading to one plot', async () => {
    const view = await render(<PlotReaderScreen />);
    await fireEvent.press(view.getByText('Rebellion'));
    expect(view.queryByText('1. Gate')).toBeNull();
    expect(view.getByText('1. Pass')).toBeTruthy();
  });

  it('shows empty states without scenes', async () => {
    mockPlotsData = plotsData({ scenes: [], sceneById: () => undefined });
    const view = await render(<PlotReaderScreen />);
    expect(view.getByText('plot_reader_no_scenes')).toBeTruthy();
    await fireEvent.press(view.getByText('Rebellion'));
    expect(view.getByText('no_plot_scenes')).toBeTruthy();
  });
});
