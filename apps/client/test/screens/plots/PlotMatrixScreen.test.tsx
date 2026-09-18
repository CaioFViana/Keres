import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import PlotMatrixScreen from '../../../src/screens/plots/PlotMatrixScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNotify = jest.fn();
const mockOpenEntity = jest.fn();
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

jest.mock('../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ options, selectedValues, onSelectionChange }: any) => (
      <>
        <Text testID="multi-selected">{selectedValues.join(',')}</Text>
        {(options ?? []).map((o: any) => (
          <Text key={o.value} onPress={() => onSelectionChange([o.value])}>
            {o.label}
          </Text>
        ))}
      </>
    ),
  };
});

jest.mock('../../../src/components/features/presence-matrix/PresenceMatrixCanvas', () => {
  const { Text } = require('react-native');
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(({ layout, onPressScene, onPressRow }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        zoomBy: jest.fn(),
        fitToScreen: jest.fn(),
      }));
      return (
        <>
          <Text testID="matrix-rows">{`rows:${layout.rows.length}`}</Text>
          <Text testID="matrix-scene" onPress={() => onPressScene('scene-1')}>
            scene
          </Text>
          <Text testID="matrix-row" onPress={() => onPressRow('plot-1')}>
            row
          </Text>
        </>
      );
    }),
  };
});

jest.mock('../../../src/components/features/graphs/GraphNodeSheet/GraphNodeSheet', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, actionLabel, onAction, onClose, sections }: any) => (
      <>
        <Text testID="sheet-title">{title}</Text>
        <Text testID="sheet-sections">{`sections:${sections.length}`}</Text>
        <Text testID="sheet-action" onPress={onAction}>
          {actionLabel}
        </Text>
        <Text testID="sheet-close" onPress={onClose}>
          close
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

jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockOpenEntity,
}));

jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  useStoryVocabulary: () => ({ term: (key: string) => key }),
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
    { id: 'plot-1', name: 'Rebellion', details: 'Uprising' },
    { id: 'plot-2', name: 'Romance', details: null },
  ];
  const scenes = [
    { id: 'scene-1', name: 'Gate', chapterId: 'chapter-1', summary: 'It begins.' },
    { id: 'scene-2', name: 'Pass', chapterId: null, summary: null },
  ];
  const relations = [
    { id: 'r1', plotId: 'plot-1', sceneId: 'scene-1', note: 'Opens here' },
    { id: 'r2', plotId: 'plot-2', sceneId: 'scene-2', note: '' },
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
    coverageOf: () => ({ covered: 1, total: 2, percentage: 50 }),
    presentationOrder: 'chapters',
    layerOf: () => undefined,
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('PlotMatrixScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockStory = { id: 'story-1', type: 'linear', title: 'Story' };
    mockPlotsData = plotsData();
    mockDeliverExport.mockResolvedValue({ delivered: true, fileName: 'story-tramas.svg' });
  });

  it('shows loading state', async () => {
    mockPlotsData = plotsData({ loading: true });
    const view = await render(<PlotMatrixScreen />);
    expect(view.getByText('loading_plots')).toBeTruthy();
  });

  it('preselects the first plots and renders the matrix', async () => {
    const view = await render(<PlotMatrixScreen />);
    expect(view.getByTestId('multi-selected').props.children).toBe('plot-1,plot-2');
    expect(view.getByTestId('matrix-rows').props.children).toBe('rows:2');
    expect(view.getByText('plot_matrix_context')).toBeTruthy();
  });

  it('narrows the visible series', async () => {
    const view = await render(<PlotMatrixScreen />);
    await fireEvent.press(view.getByText('Romance'));
    expect(view.getByTestId('multi-selected').props.children).toBe('plot-2');
    expect(view.getByTestId('matrix-rows').props.children).toBe('rows:1');
  });

  it('shows the empty state without scenes', async () => {
    mockPlotsData = plotsData({ scenes: [], sceneById: () => undefined });
    const view = await render(<PlotMatrixScreen />);
    expect(view.getByText('plot_matrix_start_title')).toBeTruthy();
    expect(view.getByText('plot_matrix_empty_scenes')).toBeTruthy();
  });

  it('opens a scene sheet and navigates to the scene', async () => {
    const view = await render(<PlotMatrixScreen />);
    await fireEvent.press(view.getByTestId('matrix-scene'));
    expect(view.getByTestId('sheet-title').props.children).toBe('Gate');
    await fireEvent.press(view.getByTestId('sheet-action'));
    expect(mockOpenEntity).toHaveBeenCalledWith(
      'Scene',
      'scene-1',
      expect.objectContaining({ onReturn: expect.any(Function) }),
    );
  });

  it('opens a plot sheet and navigates to the plot', async () => {
    const view = await render(<PlotMatrixScreen />);
    await fireEvent.press(view.getByTestId('matrix-row'));
    expect(view.getByTestId('sheet-title').props.children).toBe('Rebellion');
    await fireEvent.press(view.getByText('plot_matrix_open_plot'));
    expect(mockNavigate).toHaveBeenCalledWith('PlotDetail', { plotId: 'plot-1' });
  });

  it('closes sheets', async () => {
    const view = await render(<PlotMatrixScreen />);
    await fireEvent.press(view.getByTestId('matrix-scene'));
    expect(view.getByTestId('sheet-title')).toBeTruthy();
    await fireEvent.press(view.getByTestId('sheet-close'));
    expect(view.queryByTestId('sheet-title')).toBeNull();
  });

  it('exports the matrix', async () => {
    const view = await render(<PlotMatrixScreen />);
    await fireEvent.press(view.getByLabelText('plot_matrix_export'));
    expect(mockDeliverExport).toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith('plot_matrix_export_success', 'success');
  });

  it('warns when the export has no share target', async () => {
    mockDeliverExport.mockResolvedValue({ delivered: false, fileName: 'f.svg', uri: '' });
    const view = await render(<PlotMatrixScreen />);
    await fireEvent.press(view.getByLabelText('plot_matrix_export'));
    expect(mockNotify).toHaveBeenCalledWith('plot_matrix_export_no_share_target', 'warning');
  });
});
