import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import StatComparisonScreen from '../../../src/screens/stats/StatComparisonScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNotify = jest.fn();
const mockNavigateToEntity = jest.fn();
const mockDeliverExport = jest.fn();
let mockRouteParams: any = {};
let mockStory: any = null;
let mockStatsData: any = null;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    getParent: () => ({ navigate: mockNavigate }),
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
    SingleSelectPill: ({ options, value, onValueChange }: any) => (
      <>
        <Text testID="single-value">{value ?? 'none'}</Text>
        {(options ?? []).map((o: any) => (
          <Text key={o.value || 'normal'} onPress={() => onValueChange(o.value)}>
            {o.label}
          </Text>
        ))}
      </>
    ),
  };
});

jest.mock('../../../src/components/features/stats/StatRadarChart/StatRadarChart', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    StatRadarChart: ({ layout, emptyMessage }: any) => (
      <Text testID="radar">{layout ? `series:${layout.series.length}` : emptyMessage}</Text>
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

jest.mock('../../../src/hooks/useStoryStats', () => ({
  useStoryStats: () => mockStatsData,
}));

jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isCompact: true }),
}));

jest.mock('../../../src/vocabulary/useStoryVocabulary', () => ({
  useStoryVocabulary: () => ({ term: (key: string) => key }),
}));

jest.mock('../../../src/utils/entityNavigation', () => ({
  navigateToEntityDetail: (...a: any[]) => mockNavigateToEntity(...a),
  toNavigableEntityType: () => 'Character',
}));

jest.mock('../../../src/utils/storyTransfer', () => ({
  deliverMapExport: (...a: any[]) => mockDeliverExport(...a),
  buildBoardMapFileName: (a: string, b: string) => `${a}-${b}.svg`,
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  useBackButtonHandler: ({ onBack }: any = {}) => {
    (global as any).__lastBackHandler = onBack;
  },
}));
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
  index.set('char-1::stat-2', 4);
  index.set('char-2::stat-1', 3);
  index.set('char-2::stat-2', 8);
  return {
    characters: [
      { id: 'char-1', name: 'Ilda' },
      { id: 'char-2', name: 'Rurik' },
    ],
    stats: [
      { id: 'stat-1', name: 'Strength', isPrimary: true },
      { id: 'stat-2', name: 'Wit', isPrimary: true },
      { id: 'stat-3', name: 'Lore', isPrimary: true },
    ],
    primaryStats: [
      { id: 'stat-1', name: 'Strength', isPrimary: true },
      { id: 'stat-2', name: 'Wit', isPrimary: true },
      { id: 'stat-3', name: 'Lore', isPrimary: true },
    ],
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

describe('StatComparisonScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = {};
    mockStory = { id: 'story-1', type: 'linear', title: 'Story', statNotation: 'letter' };
    mockStatsData = statsData();
    mockDeliverExport.mockResolvedValue({ delivered: true, fileName: 'story-stats.svg' });
  });

  it('starts empty and selects characters', async () => {
    const view = await render(<StatComparisonScreen />);
    expect(view.getByTestId('radar').props.children).toBe('series:0');
    await fireEvent.press(view.getByText('Ilda'));
    expect(view.getByTestId('radar').props.children).toBe('series:1');
    expect(view.getByText('stat_export')).toBeTruthy();
  });

  it('opens preselected from a character', async () => {
    mockRouteParams = { characterId: 'char-2', modeId: null };
    const view = await render(<StatComparisonScreen />);
    expect(view.getByTestId('radar').props.children).toBe('series:1');
  });

  it('switches a series mode', async () => {
    mockRouteParams = { characterId: 'char-1', modeId: null };
    const view = await render(<StatComparisonScreen />);
    await fireEvent.press(view.getByText('In the storm'));
    expect(view.getByTestId('single-value').props.children).toBe('mode-1');
  });

  it('exports the chart', async () => {
    mockRouteParams = { characterId: 'char-1', modeId: null };
    const view = await render(<StatComparisonScreen />);
    await fireEvent.press(view.getByText('stat_export'));
    expect(mockDeliverExport).toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith('stat_export_success', 'success');
  });

  it('warns when the export has no share target', async () => {
    mockDeliverExport.mockResolvedValue({ delivered: false, fileName: 'f.svg', uri: '/tmp/f.svg' });
    mockRouteParams = { characterId: 'char-1', modeId: null };
    const view = await render(<StatComparisonScreen />);
    await fireEvent.press(view.getByText('stat_export'));
    expect(mockNotify).toHaveBeenCalledWith('stat_export_no_share_target', 'warning');
  });
});
