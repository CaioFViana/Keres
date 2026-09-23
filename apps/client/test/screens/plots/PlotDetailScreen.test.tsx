import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import PlotDetailScreen from '../../../src/screens/plots/PlotDetailScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockOpenEntity = jest.fn();
let mockRouteParams: any = { plotId: 'plot-1' };
let mockStory: any = null;
let mockPlotsData: any = null;
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

jest.mock(
  '../../../src/components/features/relations/RelationManager/GenericRelationDisplay',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({ title, relations, getRelatedItem, getRelationItemId, onItemPress }: any) => (
        <>
          <Text testID="grd-title">{title}</Text>
          <Text testID="grd-count">{String(relations.length)}</Text>
          {relations.map((relation: any) => {
            const item = getRelatedItem(getRelationItemId(relation));
            return item ? (
              <Text
                key={relation.id}
                testID={`grd-${relation.id}`}
                onPress={() => onItemPress(item)}
              >
                {item.name}
              </Text>
            ) : null;
          })}
        </>
      ),
    };
  },
);

jest.mock('../../../src/components/features/mentions/EntityMetadataWithBacklinks', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="entity-metadata">metadata</Text>,
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

jest.mock('../../../src/hooks/useNavigateToEntityDetail', () => ({
  useNavigateToEntityDetail: () => mockOpenEntity,
}));

jest.mock('../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  useVocabularyEntityCopy: () => ({ entity: 'Chapter' }),
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));

const stamp = new Date('2026-01-01T00:00:00.000Z');

function plotsData(overrides: any = {}) {
  const plot = {
    id: 'plot-1',
    storyId: 'story-1',
    name: 'Rebellion',
    details: 'The uprising',
    version: 1,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const scenes: Record<string, any> = {
    'scene-1': { id: 'scene-1', name: 'Gate', chapterId: 'chapter-1' },
  };
  const relations = [{ id: 'r1', plotId: 'plot-1', sceneId: 'scene-1', note: 'Opens here' }];
  return {
    plots: [plot],
    relations,
    scenes: Object.values(scenes),
    chapters: [{ id: 'chapter-1', name: 'Arrival' }],
    choices: [],
    relationsOf: () => relations,
    sceneById: (id: string) => scenes[id],
    chapterNameOf: (id: string | null) => (id === 'chapter-1' ? 'Arrival' : undefined),
    plotById: (id: string) => (id === 'plot-1' ? plot : undefined),
    coverageOf: () => ({ covered: 1, total: 4, percentage: 25 }),
    presentationOrder: 'chapters',
    layerOf: () => undefined,
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('PlotDetailScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = { plotId: 'plot-1' };
    mockStory = { id: 'story-1', type: 'linear', title: 'Story' };
    mockCanEdit = true;
    mockPlotsData = plotsData();
  });

  it('shows loading state', async () => {
    mockPlotsData = plotsData({ loading: true });
    const view = await render(<PlotDetailScreen />);
    expect(view.getByText('loading_plot_details')).toBeTruthy();
  });

  it('shows not found for an unknown plot', async () => {
    mockRouteParams = { plotId: 'missing' };
    const view = await render(<PlotDetailScreen />);
    expect(view.getByText('plot_not_found')).toBeTruthy();
  });

  it('renders the plot with scenes and metadata', async () => {
    const view = await render(<PlotDetailScreen />);
    expect(view.getByText('Rebellion')).toBeTruthy();
    expect(view.getByText('The uprising')).toBeTruthy();
    expect(view.getByText('plot_coverage_value')).toBeTruthy();
    expect(view.getByTestId('grd-title').props.children).toBe('plot_scenes');
    expect(view.getByTestId('grd-count').props.children).toBe('1');
    expect(view.getByTestId('entity-metadata')).toBeTruthy();
    await fireEvent.press(view.getByTestId('grd-r1'));
    expect(mockOpenEntity).toHaveBeenCalledWith(
      'Scene',
      'scene-1',
      expect.objectContaining({ onReturn: expect.any(Function) }),
    );
  });

  it('goes back from the footer', async () => {
    const view = await render(<PlotDetailScreen />);
    await fireEvent.press(view.getByText('go_back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('lands a routed occurrence on its field, flashing', async () => {
    mockRouteParams = {
      plotId: 'plot-1',
      occurrence: { field: 'details', needle: 'uprising' },
    };
    const view = await render(<PlotDetailScreen />);

    expect(StyleSheet.flatten(view.getByText('uprising').props.style).backgroundColor).toBe(
      '#00f',
    );
  });
});
