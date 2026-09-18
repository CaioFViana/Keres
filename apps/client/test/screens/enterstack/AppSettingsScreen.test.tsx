const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockDispatch = jest.fn();
const mockNavigation = { dispatch: (...args: unknown[]) => mockDispatch(...args) };
const mockSelectAll = jest.fn();
const mockDrizzle = {
  select: () => ({ from: () => ({ all: (...args: unknown[]) => mockSelectAll(...args) }) }),
};
const mockSqliteDb = {};
const mockResetDatabase = jest.fn();
const mockSetUsername = jest.fn();
const mockSetLanguage = jest.fn();
const mockSetUse24HourTime = jest.fn();
const mockSetDateDisplayFormat = jest.fn();
const mockSetShowContextualHelp = jest.fn();
const mockSetSuggestLiteraryDevices = jest.fn();
const mockSetExportFormat = jest.fn();
const mockResetSettings = jest.fn();
const mockUserSettings = {
  username: 'Bob',
  language: 'en',
  use24HourTime: true,
  dateDisplayFormat: 'iso',
  showContextualHelp: true,
  suggestLiteraryDevices: false,
  exportFormat: 'svg',
  setUsername: (...args: unknown[]) => mockSetUsername(...args),
  setLanguage: (...args: unknown[]) => mockSetLanguage(...args),
  setUse24HourTime: (...args: unknown[]) => mockSetUse24HourTime(...args),
  setDateDisplayFormat: (...args: unknown[]) => mockSetDateDisplayFormat(...args),
  setShowContextualHelp: (...args: unknown[]) => mockSetShowContextualHelp(...args),
  setSuggestLiteraryDevices: (...args: unknown[]) => mockSetSuggestLiteraryDevices(...args),
  setExportFormat: (...args: unknown[]) => mockSetExportFormat(...args),
  resetSettings: (...args: unknown[]) => mockResetSettings(...args),
};
const mockSetDarkMode = jest.fn();
const mockResetTheme = jest.fn();
const mockThemeState = {
  darkMode: false,
  setDarkMode: (...args: unknown[]) => mockSetDarkMode(...args),
  resetTheme: (...args: unknown[]) => mockResetTheme(...args),
};
const mockClearAllAuth = jest.fn();
const mockSetAuthDb = jest.fn();
const mockDeleteAllMedia = jest.fn();
const mockSyncReset = jest.fn();
const mockResetAllClientStores = jest.fn();
const mockChangeLanguage = jest.fn();
const mockSetTheme = jest.fn();
const mockColors = {
  primary: '#0000ff',
  onPrimary: '#ffffff',
  primaryContainer: '#e0e0ff',
  onPrimaryContainer: '#000088',
  secondary: '#00aa00',
  onSecondary: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  background: '#ffffff',
  surface: '#f5f5f5',
  border: '#cccccc',
  error: '#ff0000',
  onError: '#ffffff',
  accent: '#ff8800',
  onAccent: '#000000',
  notification: '#00aaff',
  onNotification: '#000000',
  shadow: '#000000',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => mockI18n,
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  StackActions: { replace: (name: string) => ({ type: 'REPLACE', name }) },
}));

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockSqliteDb,
}));

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: mockSetTheme, colors: mockColors }),
  };
});

jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => {},
}));

jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  useBackButtonHandler: () => {},
}));

jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 20,
}));

jest.mock('../../../src/db', () => ({
  useDrizzle: () => mockDrizzle,
  resetDatabase: (...args: unknown[]) => mockResetDatabase(...args),
}));

jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('../../../src/services/AuthTokenManager', () => ({
  authTokenManager: {
    clearAllAuth: (...args: unknown[]) => mockClearAllAuth(...args),
  },
  setAuthDb: (...args: unknown[]) => mockSetAuthDb(...args),
}));

jest.mock('../../../src/services/MediaFileService', () => ({
  mediaFileService: {
    deleteAllMedia: (...args: unknown[]) => mockDeleteAllMedia(...args),
  },
}));

jest.mock('../../../src/services/sync/appSyncEngine', () => ({
  syncEngine: { reset: (...args: unknown[]) => mockSyncReset(...args) },
}));

jest.mock('../../../src/state/resetAllClientStores', () => ({
  resetAllClientStores: (...args: unknown[]) => mockResetAllClientStores(...args),
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockUserSettings) : mockUserSettings,
}));

jest.mock('../../../src/state/themeStore', () => ({
  useThemeStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockThemeState) : mockThemeState,
}));

jest.mock('../../../src/utils/i18n', () => ({
  __esModule: true,
  default: { changeLanguage: (...args: unknown[]) => mockChangeLanguage(...args) },
  getLanguageOptions: () => [
    { label: 'English', value: 'en' },
    { label: 'Português', value: 'pt' },
  ],
}));

type PillProps = {
  options: Array<{ label: string; value: string }>;
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder: string;
};

jest.mock('../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    SingleSelectPill: (props: PillProps) => (
      <>
        <Text testID={`pill-${props.placeholder}`}>{`${props.placeholder}:${props.value}`}</Text>
        {props.options.map((option) => (
          <Text
            key={option.value}
            testID={`pill-${props.placeholder}-${option.value}`}
            onPress={() => props.onValueChange(option.value)}
          >
            {option.label}
          </Text>
        ))}
        <Text testID={`pill-${props.placeholder}-clear`} onPress={() => props.onValueChange(null)}>
          clear
        </Text>
        <Text
          testID={`pill-${props.placeholder}-bogus`}
          onPress={() => props.onValueChange('bogus')}
        >
          bogus
        </Text>
      </>
    ),
  };
});

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../../../src/screens/enterstack/AppSettingsScreen';

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

describe('AppSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectAll.mockResolvedValue([{ id: 'srv-1' }]);
    mockResetDatabase.mockResolvedValue(undefined);
    mockClearAllAuth.mockResolvedValue(undefined);
    mockDeleteAllMedia.mockResolvedValue(undefined);
    mockSyncReset.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the current settings and branding', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('username');
    expect(view.getByPlaceholderText('enter_username').props.value).toBe('Bob');
    expect(view.getByText('select_language')).toBeTruthy();
    expect(view.getByText('dark_mode')).toBeTruthy();
    expect(view.getByText('use_24_hour_time_on')).toBeTruthy();
    expect(view.getByText('suggest_literary_devices_off')).toBeTruthy();
    expect(view.getByText('show_contextual_help_on')).toBeTruthy();
    expect(view.getByText('reset_application')).toBeTruthy();
    expect(view.getByText(/Keres/)).toBeTruthy();
    expect(view.getByTestId('pill-select_language').props.children).toBe('select_language:en');
  });

  it('updates the username', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('username');
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), 'Alice');
    expect(mockSetUsername).toHaveBeenCalledWith(mockDrizzle, 'Alice');
  });

  it('changes the language and falls back to English on null', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByTestId('pill-select_language-pt');
    await fireEvent.press(view.getByTestId('pill-select_language-pt'));
    expect(mockSetLanguage).toHaveBeenCalledWith(mockDrizzle, 'pt');
    expect(mockChangeLanguage).toHaveBeenCalledWith('pt');

    await fireEvent.press(view.getByTestId('pill-select_language-clear'));
    expect(mockSetLanguage).toHaveBeenCalledWith(mockDrizzle, 'en');
    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  });

  it('toggles the boolean settings', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('dark_mode');
    const switches = view.getAllByRole('switch');
    expect(switches).toHaveLength(4);
    await fireEvent.press(switches[0]);
    expect(mockSetDarkMode).toHaveBeenCalledWith(mockDrizzle, true);
    await fireEvent.press(switches[1]);
    expect(mockSetUse24HourTime).toHaveBeenCalledWith(mockDrizzle, false);
    await fireEvent.press(switches[2]);
    expect(mockSetSuggestLiteraryDevices).toHaveBeenCalledWith(mockDrizzle, true);
    await fireEvent.press(switches[3]);
    expect(mockSetShowContextualHelp).toHaveBeenCalledWith(mockDrizzle, false);
  });

  it('changes date and export formats and ignores invalid values', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByTestId('pill-date_display_format-dmy');
    await fireEvent.press(view.getByTestId('pill-date_display_format-dmy'));
    expect(mockSetDateDisplayFormat).toHaveBeenCalledWith(mockDrizzle, 'dmy');
    await fireEvent.press(view.getByTestId('pill-date_display_format-bogus'));
    expect(mockSetDateDisplayFormat).toHaveBeenCalledTimes(1);

    await fireEvent.press(view.getByTestId('pill-export_format-png'));
    expect(mockSetExportFormat).toHaveBeenCalledWith(mockDrizzle, 'png');
    await fireEvent.press(view.getByTestId('pill-export_format-bogus'));
    expect(mockSetExportFormat).toHaveBeenCalledTimes(1);
  });

  it('resets the application after confirmation', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('reset_application');
    await fireEvent.press(view.getByText('reset_application'));
    expect(mockAlert).toHaveBeenCalledWith(
      'reset_application_title',
      'reset_application_message',
      expect.any(Array),
      { cancelable: true },
    );
    const reset = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'reset');
    await act(async () => {
      await reset?.onPress?.();
    });
    await waitFor(() => expect(mockResetDatabase).toHaveBeenCalledWith(mockSqliteDb));
    expect(mockResetSettings).toHaveBeenCalled();
    expect(mockSyncReset).toHaveBeenCalled();
    expect(mockClearAllAuth).toHaveBeenCalledWith(['srv-1']);
    expect(mockSetAuthDb).toHaveBeenCalledWith(null);
    expect(mockDeleteAllMedia).toHaveBeenCalled();
    expect(mockResetAllClientStores).toHaveBeenCalled();
    expect(mockResetTheme).toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'REPLACE', name: 'ColdInstall' });
  });

  it('reports reset failures', async () => {
    mockResetDatabase.mockRejectedValue(new Error('boom'));
    const view = await render(<SettingsScreen />);
    await view.findByText('reset_application');
    await fireEvent.press(view.getByText('reset_application'));
    const reset = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'reset');
    await act(async () => {
      await reset?.onPress?.();
    });
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'reset_application_error'));
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
