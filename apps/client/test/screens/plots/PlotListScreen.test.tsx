import { cleanup, fireEvent, render } from '@testing-library/react-native';
import PlotListScreen from '../../../src/screens/plots/PlotListScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockUseScreenTour = jest.fn();
let mockStory: any = null;
let mockPlotsData: any = null;
let mockCanEdit = true;
let mockListProps: {
  emptyStateTitle?: string;
  emptyStateMessage?: string;
  emptyStateActions?: { label: string; onPress: () => void }[];
} | null = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));

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

jest.mock(
  '../../../src/components/common/lists/GenericFilterSortList/GenericFilterSortList',
  () => {
    const { Text } = require('react-native');
    const React = require('react');
    return {
      __esModule: true,
      default: (props: any) => {
        mockListProps = props;
        const {
          data,
          renderItem,
          keyExtractor,
          onSearch,
          onSortChange,
          onSortDirectionChange,
          emptyStateTitle,
          emptyStateActions,
        } = props;
        return (
          <>
            <Text testID="gfs-search" onPress={() => onSearch('north')}>
              search
            </Text>
            <Text testID="gfs-sort" onPress={() => onSortChange('sceneCount')}>
              sort
            </Text>
            <Text testID="gfs-dir" onPress={() => onSortDirectionChange('desc')}>
              dir
            </Text>
            {data.length === 0 ? (
              <>
                <Text testID="empty-title">{emptyStateTitle}</Text>
                {(emptyStateActions ?? []).map((action: any) => (
                  <Text
                    key={action.label}
                    testID={`empty-action-${action.label}`}
                    onPress={action.onPress}
                  >
                    {action.label}
                  </Text>
                ))}
              </>
            ) : (
              data.map((item: any) => (
                <React.Fragment key={keyExtractor(item)}>{renderItem({ item })}</React.Fragment>
              ))
            )}
          </>
        );
      },
    };
  },
);

jest.mock('../../../src/components/features/list-items/PlotListItem', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ plot, sceneCount, onViewDetails }: any) => (
      <Text testID={`plot-${plot.id}`} onPress={() => onViewDetails(plot.id)}>
        {`${plot.name}:${sceneCount}`}
      </Text>
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
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));

const stamp = (iso: string) => new Date(iso);

function plotsData(overrides: any = {}) {
  const plots = [
    {
      id: 'plot-2',
      name: 'Beta',
      details: null,
      createdAt: stamp('2026-01-02'),
      updatedAt: stamp('2026-01-03'),
    },
    {
      id: 'plot-1',
      name: 'alpha',
      details: 'First thread',
      createdAt: stamp('2026-01-01'),
      updatedAt: stamp('2026-01-01'),
    },
  ];
  return {
    plots,
    relations: [{ id: 'r1', plotId: 'plot-1', sceneId: 'scene-1' }],
    scenes: [],
    chapters: [],
    choices: [],
    relationsOf: (plotId: string) =>
      [{ id: 'r1', plotId: 'plot-1', sceneId: 'scene-1' }].filter((r) => r.plotId === plotId),
    sceneById: () => undefined,
    chapterNameOf: () => undefined,
    plotById: (id: string) => plots.find((p) => p.id === id),
    coverageOf: () => ({ covered: 0, total: 0, percentage: 0 }),
    presentationOrder: 'chapters',
    layerOf: () => undefined,
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('PlotListScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockStory = { id: 'story-1', type: 'linear', title: 'Story' };
    mockCanEdit = true;
    mockPlotsData = plotsData();
  });

  it('requests its guided tour', async () => {
    await render(<PlotListScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('PlotsStack');
  });

  it('asks for a story when none is selected', async () => {
    mockStory = null;
    const view = await render(<PlotListScreen />);
    expect(view.getByText('no_story_selected')).toBeTruthy();
  });

  it('shows loading state on first load', async () => {
    mockPlotsData = plotsData({ plots: [], loading: true });
    const view = await render(<PlotListScreen />);
    expect(view.getByText('loading_plots')).toBeTruthy();
  });

  it('lists plots sorted by name and opens the detail', async () => {
    const view = await render(<PlotListScreen />);
    expect(view.getByTestId('plot-plot-1').props.children).toBe('alpha:1');
    expect(view.getByTestId('plot-plot-2').props.children).toBe('Beta:0');
    await fireEvent.press(view.getByTestId('plot-plot-1'));
    expect(mockNavigate).toHaveBeenCalledWith('PlotDetail', { plotId: 'plot-1' });
  });

  it('filters by the search term', async () => {
    const view = await render(<PlotListScreen />);
    await fireEvent.press(view.getByTestId('gfs-search'));
    expect(view.queryByTestId('plot-plot-1')).toBeNull();
    expect(view.queryByTestId('plot-plot-2')).toBeNull();
    expect(view.getByTestId('empty-title').props.children).toBe('plots_empty_title');
  });

  it('guides the empty list toward creation', async () => {
    const view = await render(<PlotListScreen />);
    await fireEvent.press(view.getByTestId('gfs-search'));

    expect(mockListProps?.emptyStateTitle).toBe('plots_empty_title');
    expect(mockListProps?.emptyStateMessage).toBe('plots_empty_message');
    expect(mockListProps?.emptyStateActions?.map((action) => action.label)).toEqual([
      'plots_empty_create',
    ]);
    mockListProps?.emptyStateActions?.[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('PlotForm', {});
  });

  it('sorts by scene count and direction', async () => {
    const view = await render(<PlotListScreen />);
    await fireEvent.press(view.getByTestId('gfs-sort'));
    await fireEvent.press(view.getByTestId('gfs-dir'));
    expect(view.getByTestId('plot-plot-1')).toBeTruthy();
    expect(view.getByTestId('plot-plot-2')).toBeTruthy();
  });
});
