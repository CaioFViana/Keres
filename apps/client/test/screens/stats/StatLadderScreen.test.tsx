import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { withSilencedConsole } from '../../helpers/silenceConsole';
import StatLadderScreen from '../../../src/screens/stats/StatLadderScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockAlert = jest.fn();
const mockReplaceLadder = jest.fn();
let mockRouteParams: any = {};
let mockStory: any = null;
let mockStatsData: any = null;

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

jest.mock('../../../src/components/features/stats/StatLadderBar/StatLadderBar', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    StatLadderBar: ({ ladder }: any) => <Text testID="ladder-bar">{`tiers:${ladder.length}`}</Text>,
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

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (s: any) => any) => {
    const state = { userId: 'user-1', exportFormat: 'svg' };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/hooks/useStoryStats', () => ({
  useStoryStats: () => mockStatsData,
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));
jest.mock('../../../src/db', () => ({ useDrizzle: () => ({}) }));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...a: any[]) => mockAlert(...a) },
}));
jest.mock('../../../src/services/storymanagement/StatStrengthService', () => ({
  createStatStrengthService: () => ({ replaceLadder: mockReplaceLadder }),
}));

const defaultLadder = [
  { id: 's-f', label: 'F', minValue: 0 },
  { id: 's-a', label: 'A', minValue: 10 },
];

function statsData(overrides: any = {}) {
  return {
    characters: [],
    stats: [{ id: 'stat-1', name: 'Strength', isPrimary: true }],
    primaryStats: [{ id: 'stat-1', name: 'Strength', isPrimary: true }],
    strengths: [
      { id: 's-f', statId: null, label: 'F', minValue: 0 },
      { id: 's-a', statId: null, label: 'A', minValue: 10 },
    ],
    modes: [],
    values: [],
    valueIndex: new Map(),
    ladderOf: () => defaultLadder,
    defaultLadder,
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('StatLadderScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = {};
    mockStory = { id: 'story-1', type: 'linear', title: 'Story', statNotation: 'letter' };
    mockStatsData = statsData();
    mockReplaceLadder.mockResolvedValue(undefined);
  });

  it('hydrates the default ladder and saves it', async () => {
    const view = await render(<StatLadderScreen />);
    expect(view.getByDisplayValue('F')).toBeTruthy();
    expect(view.getByDisplayValue('A')).toBeTruthy();
    expect(view.getByTestId('ladder-bar').props.children).toBe('tiers:2');
    await fireEvent.press(view.getByText('save'));
    expect(mockReplaceLadder).toHaveBeenCalledWith('user-1', 'story-1', null, [
      { id: 's-f', label: 'F', minValue: 0 },
      { id: 's-a', label: 'A', minValue: 10 },
    ]);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('adds, edits and removes tiers', async () => {
    const view = await render(<StatLadderScreen />);
    await fireEvent.press(view.getByText('stat_tier_add'));
    const labels = view.getAllByPlaceholderText('stat_tier_label');
    await fireEvent.changeText(labels[2], 'S');
    const values = view.getAllByPlaceholderText('stat_tier_min_value');
    await fireEvent.changeText(values[2], '20');
    expect(view.getByDisplayValue('S')).toBeTruthy();
    await fireEvent.press(view.getAllByLabelText('delete')[2]);
    expect(view.queryByDisplayValue('S')).toBeNull();
  });

  it('validates tier labels, values and duplicates', async () => {
    const view = await render(<StatLadderScreen />);
    await fireEvent.press(view.getByText('stat_tier_add'));
    await fireEvent.press(view.getByText('save'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'stat_tier_label_required');
    const labels = view.getAllByPlaceholderText('stat_tier_label');
    await fireEvent.changeText(labels[2], 'S');
    await fireEvent.press(view.getByText('save'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'stat_tier_value_invalid');
    const values = view.getAllByPlaceholderText('stat_tier_min_value');
    await fireEvent.changeText(values[2], '10');
    await fireEvent.press(view.getByText('save'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'stat_tier_duplicate_value');
    expect(mockReplaceLadder).not.toHaveBeenCalled();
  });

  it('alerts when saving fails', async () => {
    await withSilencedConsole(['error'], async () => {
      mockReplaceLadder.mockRejectedValue(new Error('boom'));
      const view = await render(<StatLadderScreen />);
      await fireEvent.press(view.getByText('save'));
      expect(mockAlert).toHaveBeenCalledWith('error', 'boom');
    });
  });

  it('opts a stat out of its own ladder', async () => {
    mockRouteParams = { statId: 'stat-1' };
    mockStatsData = statsData({
      strengths: [{ id: 'own-1', statId: 'stat-1', label: 'X', minValue: 5 }],
    });
    const view = await render(<StatLadderScreen />);
    expect(view.getByTestId('themed-switch').props.children).toBe('on');
    await fireEvent.press(view.getByTestId('themed-switch'));
    await fireEvent.press(view.getByText('save'));
    expect(mockReplaceLadder).toHaveBeenCalledWith('user-1', 'story-1', 'stat-1', []);
  });

  it('generates a numeric ladder', async () => {
    mockStory = { ...mockStory, statNotation: 'number' };
    const view = await render(<StatLadderScreen />);
    expect(view.getByText('stat_ladder_generator_title')).toBeTruthy();
    await fireEvent.changeText(view.getByPlaceholderText('stat_ladder_generator_min'), '0');
    await fireEvent.changeText(view.getByPlaceholderText('stat_ladder_generator_max'), '20');
    await fireEvent.changeText(view.getByPlaceholderText('stat_ladder_generator_step'), '10');
    await fireEvent.press(view.getByText('stat_ladder_generate'));
    expect(view.getByTestId('ladder-bar').props.children).toBe('tiers:3');
  });

  it('alerts on an invalid generator range', async () => {
    mockStory = { ...mockStory, statNotation: 'number' };
    const view = await render(<StatLadderScreen />);
    await fireEvent.changeText(view.getByPlaceholderText('stat_ladder_generator_step'), '0');
    await fireEvent.press(view.getByText('stat_ladder_generate'));
    expect(mockAlert).toHaveBeenCalledWith('error', expect.any(String));
  });
});
