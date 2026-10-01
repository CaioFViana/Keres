import { cleanup, fireEvent, render } from '@testing-library/react-native';
import StatRankingScreen from '../../../src/screens/stats/StatRankingScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockNavigateToEntity = jest.fn();
let mockRouteParams: any = {};
let mockStory: any = null;
let mockStatsData: any = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    getParent: () => ({ navigate: mockParentNavigate }),
  }),
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

jest.mock('../../../src/components/common/controls/ThemedSwitch/ThemedSwitch', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, onValueChange, testID }: any) => (
      <Text testID={testID ?? 'themed-switch'} onPress={() => onValueChange(!value)}>
        {value ? 'on' : 'off'}
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

jest.mock('../../../src/hooks/useStoryStats', () => ({
  useStoryStats: () => mockStatsData,
}));

jest.mock('../../../src/utils/entityNavigation', () => ({
  navigateToEntityDetail: (...a: any[]) => mockNavigateToEntity(...a),
  toNavigableEntityType: () => 'Character',
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));

const ladder = [
  { label: 'F', minValue: 0 },
  { label: 'A', minValue: 10 },
];

function statsData(overrides: any = {}) {
  const index = new Map<string, number>();
  index.set('char-1::stat-1', 12);
  index.set('char-2::stat-1', 3);
  return {
    characters: [
      { id: 'char-1', name: 'Ilda' },
      { id: 'char-2', name: 'Rurik' },
    ],
    stats: [
      { id: 'stat-1', name: 'Strength', isPrimary: true },
      { id: 'stat-2', name: 'Wit', isPrimary: true },
    ],
    primaryStats: [{ id: 'stat-1', name: 'Strength', isPrimary: true }],
    strengths: [],
    modes: [{ id: 'mode-1', characterId: 'char-1', name: 'In the storm' }],
    values: [],
    valueIndex: index,
    ladderOf: () => ladder,
    defaultLadder: ladder,
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('StatRankingScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = {};
    mockStory = { id: 'story-1', type: 'linear', title: 'Story', statNotation: 'letter' };
    mockStatsData = statsData();
  });

  it('starts with the first stat and ranks characters', async () => {
    const view = await render(<StatRankingScreen />);
    expect(view.getByTestId('single-value').props.children).toBe('stat-1');
    expect(view.getByText('Ilda')).toBeTruthy();
    expect(view.getByText('Rurik')).toBeTruthy();
    expect(view.getByText('Ilda · In the storm')).toBeTruthy();
  });

  it('opens the preset stat from params', async () => {
    mockRouteParams = { statId: 'stat-2' };
    const view = await render(<StatRankingScreen />);
    expect(view.getByTestId('single-value').props.children).toBe('stat-2');
  });

  it('switches stats and toggles direction', async () => {
    const view = await render(<StatRankingScreen />);
    await fireEvent.press(view.getByText('Wit'));
    expect(view.getByTestId('single-value').props.children).toBe('stat-2');
    expect(view.getByText('stat_ranking_direction_desc')).toBeTruthy();
    await fireEvent.press(view.getByText('stat_ranking_direction_desc'));
    expect(view.getByText('stat_ranking_direction_asc')).toBeTruthy();
  });

  it('hides inherited rows on demand', async () => {
    const view = await render(<StatRankingScreen />);
    expect(view.getAllByText(/stat_inherited/).length).toBeGreaterThan(0);
    await fireEvent.press(view.getByTestId('themed-switch'));
    expect(view.queryByText(/stat_inherited/)).toBeNull();
    expect(view.queryByText('Ilda · In the storm')).toBeNull();
  });

  it('opens the character detail from a row', async () => {
    const view = await render(<StatRankingScreen />);
    await fireEvent.press(view.getByText('Rurik'));
    expect(mockNavigateToEntity).toHaveBeenCalledWith(
      expect.objectContaining({ navigate: mockParentNavigate }),
      'Character',
      'char-2',
    );
  });

  it('shows the empty state without stats', async () => {
    mockStatsData = statsData({ stats: [], characters: [], modes: [] });
    const view = await render(<StatRankingScreen />);
    expect(view.getByText('stats_empty')).toBeTruthy();
  });
});
