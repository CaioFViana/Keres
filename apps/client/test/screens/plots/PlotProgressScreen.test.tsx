import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import PlotProgressScreen from '../../../src/screens/plots/PlotProgressScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNotify = jest.fn();
const mockDeliverExport = jest.fn();
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

jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector: (s: any) => any) => selector({ showNotification: mockNotify }),
}));

jest.mock('../../../src/state/userSettingsStore', () => {
  const state = { userId: 'user-1', exportFormat: 'svg' };
  const useUserSettingsStore = (selector?: (s: any) => any) =>
    typeof selector === 'function' ? selector(state) : state;
  (useUserSettingsStore as any).getState = () => state;
  return { useUserSettingsStore };
});

jest.mock('../../../src/hooks/useStoryPlots', () => ({
  useStoryPlots: () => mockPlotsData,
}));

jest.mock('../../../src/utils/storyTransfer', () => ({
  deliverMapExport: (...a: any[]) => mockDeliverExport(...a),
  buildBoardMapFileName: (a: string, b: string) => `${a}-${b}.svg`,
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));

function plotsData(overrides: any = {}) {
  const plots = [
    { id: 'plot-1', name: 'Rebellion', details: null },
    { id: 'plot-2', name: 'Romance', details: null },
  ];
  const scenes = [
    { id: 'scene-1', name: 'Gate', chapterId: 'chapter-1' },
    { id: 'scene-2', name: 'Pass', chapterId: 'chapter-1' },
  ];
  const relations = [
    { id: 'r1', plotId: 'plot-1', sceneId: 'scene-1', note: '' },
    { id: 'r2', plotId: 'plot-1', sceneId: 'scene-2', note: '' },
  ];
  return {
    plots,
    relations,
    scenes,
    chapters: [{ id: 'chapter-1', name: 'Arrival' }],
    choices: [],
    relationsOf: (plotId: string) => relations.filter((r) => r.plotId === plotId),
    sceneById: (id: string) => scenes.find((s) => s.id === id),
    chapterNameOf: (id: string | null) => (id === 'chapter-1' ? 'Arrival' : undefined),
    plotById: (id: string) => plots.find((p) => p.id === id),
    coverageOf: () => ({ covered: 0, total: 0, percentage: 0 }),
    presentationOrder: 'chapters',
    layerOf: () => undefined,
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('PlotProgressScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockStory = { id: 'story-1', type: 'linear', title: 'Story' };
    mockPlotsData = plotsData();
    mockDeliverExport.mockResolvedValue({ delivered: true, fileName: 'story-cobertura.svg' });
  });

  it('shows loading state', async () => {
    mockPlotsData = plotsData({ loading: true });
    const view = await render(<PlotProgressScreen />);
    expect(view.getByText('loading_plots')).toBeTruthy();
  });

  it('renders coverage rows with legend and opens the detail', async () => {
    const view = await render(<PlotProgressScreen />);
    expect(view.getByText('plot_average_scenes')).toBeTruthy();
    expect(view.getByText('plot_coverage_denominator')).toBeTruthy();
    expect(view.getByText('plot_coverage_overlap_hint')).toBeTruthy();
    expect(view.getByText('Arrival')).toBeTruthy();
    expect(view.getByText('Rebellion')).toBeTruthy();
    expect(view.getByText('Romance')).toBeTruthy();
    await fireEvent.press(view.getByText('Rebellion'));
    expect(mockNavigate).toHaveBeenCalledWith('PlotDetail', { plotId: 'plot-1' });
  });

  it('shows the empty state without plots', async () => {
    mockPlotsData = plotsData({ plots: [], relations: [] });
    const view = await render(<PlotProgressScreen />);
    expect(view.getByText('no_plots')).toBeTruthy();
  });
});
