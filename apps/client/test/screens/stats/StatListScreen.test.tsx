import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { withSilencedConsole } from '../../helpers/silenceConsole';
import StatListScreen from '../../../src/screens/stats/StatListScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockAlert = jest.fn();
const mockSetSelectedStory = jest.fn();
const mockDeleteStat = jest.fn();
const mockReorderStats = jest.fn();
const mockUpdateStory = jest.fn();
let mockStory: any = null;
let mockStatsData: any = null;
let mockCanEdit = true;
let mockUserId: string | null = 'user-1';
const mockUseScreenTour = jest.fn();

jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));

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

jest.mock('../../../src/components/common/controls/ThemedSwitch/ThemedSwitch', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, onValueChange, testID, disabled }: any) => (
      <Text
        testID={testID ?? 'themed-switch'}
        onPress={() => {
          if (!disabled) onValueChange(!value);
        }}
      >
        {value ? 'on' : 'off'}
      </Text>
    ),
  };
});

jest.mock('../../../src/components/common/modals/ReorderModal/ReorderModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ isVisible, onClose, onReorderConfirm, items }: any) =>
      isVisible ? (
        <>
          <Text testID="reorder-open">open</Text>
          <Text testID="reorder-confirm" onPress={() => onReorderConfirm(items)}>
            confirm
          </Text>
          <Text testID="reorder-close" onPress={onClose}>
            close
          </Text>
        </>
      ) : null,
  };
});

jest.mock('../../../src/state/storyStore', () => ({
  useStoryStore: (selector?: (s: any) => any) => {
    const state = {
      selectedStory: mockStory,
      setSelectedStory: mockSetSelectedStory,
      activeArcId: null,
      setActiveArcId: jest.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (s: any) => any) => {
    const state = { userId: mockUserId, exportFormat: 'svg' };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../src/hooks/useStoryStats', () => ({
  useStoryStats: () => mockStatsData,
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
jest.mock('../../../src/db', () => ({ useDrizzle: () => ({}) }));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...a: any[]) => mockAlert(...a) },
}));
jest.mock('../../../src/services/storymanagement/StatService', () => ({
  createStatService: () => ({ deleteStat: mockDeleteStat, reorderStats: mockReorderStats }),
}));
jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  createStoryService: () => ({ updateStory: mockUpdateStory }),
}));

const ladder = [
  { label: 'F', minValue: 0 },
  { label: 'A', minValue: 10 },
];

function statsData(overrides: any = {}) {
  const stats = [
    { id: 'stat-1', name: 'Strength', isPrimary: true },
    { id: 'stat-2', name: 'Wit', isPrimary: false },
  ];
  return {
    characters: [],
    stats,
    primaryStats: stats.filter((s) => s.isPrimary),
    strengths: [],
    modes: [],
    values: [],
    valueIndex: new Map(),
    ladderOf: () => ladder,
    defaultLadder: ladder,
    loading: false,
    reload: async () => {},
    ...overrides,
  };
}

describe('StatListScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockStory = {
      id: 'story-1',
      type: 'linear',
      title: 'Story',
      statSystem: true,
      statNotation: 'letter',
    };
    mockStatsData = statsData();
    mockCanEdit = true;
    mockUserId = 'user-1';
    mockDeleteStat.mockResolvedValue(undefined);
    mockReorderStats.mockResolvedValue(undefined);
    mockUpdateStory.mockResolvedValue(undefined);
  });

  it('requests its guided tour', async () => {
    await render(<StatListScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('StatList');
  });

  it('asks for a story when none is selected', async () => {
    mockStory = null;
    const view = await render(<StatListScreen />);
    expect(view.getByText('no_story_selected')).toBeTruthy();
  });

  it('lists primary and secondary stats and opens the form', async () => {
    const view = await render(<StatListScreen />);
    expect(view.getByText('stat_primary_section')).toBeTruthy();
    expect(view.getByText('stat_secondary_section')).toBeTruthy();
    expect(view.getByText('Strength')).toBeTruthy();
    expect(view.getByText('Wit')).toBeTruthy();
    await fireEvent.press(view.getByText('Strength'));
    expect(mockNavigate).toHaveBeenCalledWith('StatForm', { statId: 'stat-1' });
  });

  it('navigates to ranking, comparison and ladder', async () => {
    const view = await render(<StatListScreen />);
    await fireEvent.press(view.getByLabelText('stat_ranking_title'));
    expect(mockNavigate).toHaveBeenCalledWith('StatRanking', {});
    await fireEvent.press(view.getByLabelText('stat_compare_title'));
    expect(mockNavigate).toHaveBeenCalledWith('StatComparison', {});
    await fireEvent.press(view.getByLabelText('stat_ladder_default_title'));
    expect(mockNavigate).toHaveBeenCalledWith('StatLadder', {});
  });

  it('deletes a stat after confirmation', async () => {
    const view = await render(<StatListScreen />);
    await fireEvent.press(view.getAllByLabelText('delete')[0]);
    expect(mockAlert).toHaveBeenCalledWith(
      'stat_delete_title',
      'stat_delete_message',
      expect.any(Array),
      expect.any(Object),
    );
    const buttons = mockAlert.mock.calls[0][2];
    await buttons[1].onPress();
    expect(mockDeleteStat).toHaveBeenCalledWith('user-1', 'stat-1');
  });

  it('alerts when deleting fails', async () => {
    await withSilencedConsole(['error'], async () => {
      mockDeleteStat.mockRejectedValue(new Error('boom'));
      const view = await render(<StatListScreen />);
      await fireEvent.press(view.getAllByLabelText('delete')[0]);
      const buttons = mockAlert.mock.calls[0][2];
      await buttons[1].onPress();
      expect(mockAlert).toHaveBeenCalledWith('error', 'stat_save_failed');
    });
  });

  it('reorders stats through the modal', async () => {
    const view = await render(<StatListScreen />);
    await fireEvent.press(view.getByLabelText('stat_reorder_title'));
    expect(view.getByTestId('reorder-open')).toBeTruthy();
    await fireEvent.press(view.getByTestId('reorder-confirm'));
    expect(mockReorderStats).toHaveBeenCalledWith('user-1', 'story-1', [
      { id: 'stat-1', order: 0 },
      { id: 'stat-2', order: 1 },
    ]);
    expect(view.queryByTestId('reorder-open')).toBeNull();
  });

  it('saves stat system settings', async () => {
    const view = await render(<StatListScreen />);
    expect(view.getByTestId('stat-system-switch').props.children).toBe('on');
    await fireEvent.press(view.getByText('stat_notation_number'));
    await fireEvent.press(view.getByText('save_changes'));
    expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', {
      statSystem: true,
      statNotation: 'number',
    });
    expect(mockSetSelectedStory).toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('success', 'story_updated_successfully');
  });

  it('resets unsaved settings', async () => {
    const view = await render(<StatListScreen />);
    await fireEvent.press(view.getByTestId('stat-system-switch'));
    expect(view.getByTestId('stat-system-switch').props.children).toBe('off');
    await fireEvent.press(view.getAllByText('cancel')[0]);
    expect(view.getByTestId('stat-system-switch').props.children).toBe('on');
  });

  it('hides stats when the system is off', async () => {
    mockStory = { ...mockStory, statSystem: false };
    const view = await render(<StatListScreen />);
    expect(view.queryByText('Strength')).toBeNull();
    expect(view.queryByLabelText('stat_ranking_title')).toBeNull();
    expect(view.getAllByText('stat_system_description').length).toBeGreaterThan(0);
  });

  it('shows the empty state without stats', async () => {
    mockStatsData = statsData({ stats: [], primaryStats: [] });
    const view = await render(<StatListScreen />);
    expect(view.getByText('stats_empty')).toBeTruthy();
  });
});
