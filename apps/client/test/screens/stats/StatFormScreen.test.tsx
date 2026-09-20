import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import StatFormScreen from '../../../src/screens/stats/StatFormScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockHandleSave = jest.fn();
let mockRouteParams: any = {};
let mockStory: any = null;
let mockFormState: any = null;
let mockSaving = false;

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

jest.mock('../../../src/screens/stats/useStatFormResources', () => ({
  useStatFormResources: () => ({ statServiceRef: { current: {} }, data: { stats: [] } }),
}));

jest.mock('../../../src/screens/stats/useStatFormState', () => ({
  useStatFormState: () => mockFormState,
}));

jest.mock('../../../src/screens/stats/useStatFormActions', () => ({
  useStatFormActions: () => ({ handleSave: mockHandleSave, saving: mockSaving }),
}));

jest.mock('../../../src/hooks/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: jest.fn() }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 32,
}));

function formState(overrides: any = {}) {
  return {
    name: '',
    setName: jest.fn(),
    isPrimary: true,
    setIsPrimary: jest.fn(),
    loading: false,
    isEditing: false,
    isDirty: false,
    resetForm: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('StatFormScreen', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockRouteParams = {};
    mockStory = { id: 'story-1', type: 'linear', title: 'Story' };
    mockFormState = formState();
    mockSaving = false;
  });

  it('shows loading state', async () => {
    mockFormState = formState({ loading: true });
    const view = await render(<StatFormScreen />);
    expect(view.getByText('loading')).toBeTruthy();
  });

  it('creates a stat and notes the ladder comes after saving', async () => {
    const setName = jest.fn();
    const setIsPrimary = jest.fn();
    mockFormState = formState({ setName, setIsPrimary });
    const view = await render(<StatFormScreen />);
    expect(view.getByText('stat_ladder_after_save')).toBeTruthy();
    await fireEvent.changeText(view.getByPlaceholderText('stat_name_placeholder'), 'Strength');
    expect(setName).toHaveBeenCalledWith('Strength');
    await fireEvent.press(view.getByTestId('themed-switch'));
    expect(setIsPrimary).toHaveBeenCalledWith(false);
    await fireEvent.press(view.getByText('save'));
    expect(mockHandleSave).toHaveBeenCalledTimes(1);
  });

  it('edits a stat and links to its ladder', async () => {
    mockRouteParams = { statId: 'stat-1' };
    mockFormState = formState({ name: 'Strength', isPrimary: false, isEditing: true });
    const view = await render(<StatFormScreen />);
    await fireEvent.press(view.getByText('stat_ladder_title'));
    expect(mockNavigate).toHaveBeenCalledWith('StatLadder', { statId: 'stat-1' });
  });

  it('shows the saving state', async () => {
    mockSaving = true;
    const view = await render(<StatFormScreen />);
    expect(view.getByText('saving')).toBeTruthy();
  });
});
