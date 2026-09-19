const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockReplace = jest.fn();
const mockNavigation = { replace: (...args: unknown[]) => mockReplace(...args) };
const mockDrizzle = {};
const mockSqliteDb = {};
const mockMigrate = jest.fn();
const mockSetAuthDb = jest.fn();
const mockCreateClientSettings = jest.fn();
const mockBindDatabase = jest.fn();
const mockNotify = jest.fn();
const mockInitializeSettings = jest.fn();
const mockInitializeTheme = jest.fn();
const mockUseDocumentTitle = jest.fn();
const mockChangeLanguage = jest.fn();
const mockBackHandler = { current: null as null | (() => boolean | null | undefined) };
const mockNotificationState = { showNotification: (...args: unknown[]) => mockNotify(...args) };
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

jest.mock('../../../src/db', () => ({
  useDrizzle: () => mockDrizzle,
}));

jest.mock('../../../src/db/migrate', () => ({
  migrate: (...args: unknown[]) => mockMigrate(...args),
}));

jest.mock('../../../src/services/AuthTokenManager', () => ({
  setAuthDb: (...args: unknown[]) => mockSetAuthDb(...args),
}));

jest.mock('../../../src/services/ClientSettingsService', () => ({
  createClientSettings: (...args: unknown[]) => mockCreateClientSettings(...args),
}));

jest.mock('../../../src/services/sync/appSyncEngine', () => ({
  syncEngine: { bindDatabase: (...args: unknown[]) => mockBindDatabase(...args) },
}));

jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockNotificationState) : mockNotificationState,
}));

jest.mock('../../../src/state/themeStore', () => ({
  useThemeStore: (selector: (state: unknown) => unknown) =>
    selector({ initializeTheme: (...args: unknown[]) => mockInitializeTheme(...args) }),
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({ initializeSettings: (...args: unknown[]) => mockInitializeSettings(...args) }),
}));

jest.mock('../../../src/utils/documentTitle', () => ({
  useDocumentTitle: (...args: unknown[]) => mockUseDocumentTitle(...args),
}));

jest.mock('../../../src/utils/i18n', () => ({
  __esModule: true,
  default: { changeLanguage: (...args: unknown[]) => mockChangeLanguage(...args) },
  getLanguageOptions: () => [
    { label: 'English', value: 'en' },
    { label: 'Português', value: 'pt' },
  ],
}));

jest.mock('../../../src/components/common', () => {
  const { Text, TextInput } = require('react-native');
  return {
    Button: ({
      onPress,
      disabled,
      children,
    }: {
      onPress: () => void;
      disabled?: boolean;
      children?: string;
    }) => (
      <Text testID="proceed-btn" onPress={onPress}>
        {`${disabled ? 'disabled' : 'enabled'}:${children}`}
      </Text>
    ),
    FormContainer: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SingleSelectPill: ({
      options,
      value,
      onValueChange,
      placeholder,
    }: {
      options: Array<{ label: string; value: string }>;
      value: string | null;
      onValueChange: (value: string | null) => void;
      placeholder: string;
    }) => (
      <>
        <Text testID="language-value">{`${placeholder}:${value}`}</Text>
        {options.map((option) => (
          <Text
            key={option.value}
            testID={`language-${option.value}`}
            onPress={() => onValueChange(option.value)}
          >
            {option.label}
          </Text>
        ))}
      </>
    ),
    TextInput: (props: Record<string, unknown>) => <TextInput testID="username-input" {...props} />,
  };
});

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import ColdInstallScreen from '../../../src/screens/enterstack/ColdInstallScreen';

describe('ColdInstallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBackHandler.current = null;
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event: string, handler: () => boolean | null | undefined) => {
        mockBackHandler.current = handler;
        return { remove: jest.fn() };
      });
    jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
    mockMigrate.mockResolvedValue(undefined);
    mockCreateClientSettings.mockResolvedValue(undefined);
    mockBindDatabase.mockResolvedValue(undefined);
    mockInitializeSettings.mockResolvedValue(undefined);
    mockInitializeTheme.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('renders the welcome form with proceed disabled', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');
    expect(view.getByText('disabled:proceed')).toBeTruthy();
    expect(view.getByPlaceholderText('enter_username')).toBeTruthy();
    expect(mockUseDocumentTitle).toHaveBeenCalledWith('welcome');
  });

  it('validates language and username before proceeding', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('disabled:proceed');
    await fireEvent.press(view.getByTestId('proceed-btn'));
    expect(view.getByText('select_language_error')).toBeTruthy();
    expect(view.getByText('username_length_error')).toBeTruthy();
    expect(mockMigrate).not.toHaveBeenCalled();
  });

  it('selects a language and enables proceed with a valid username', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('disabled:proceed');
    await fireEvent.press(view.getByTestId('language-pt'));
    expect(mockChangeLanguage).toHaveBeenCalledWith('pt');
    expect(view.getByTestId('language-value').props.children).toBe('select_language:pt');
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), 'Bo');
    expect(view.getByText('disabled:proceed')).toBeTruthy();
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), 'Bob');
    expect(view.getByText('enabled:proceed')).toBeTruthy();
  });

  it('provisions the install and opens story selection', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('disabled:proceed');
    await fireEvent.press(view.getByTestId('language-en'));
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), 'Bob');
    await fireEvent.press(view.getByTestId('proceed-btn'));
    await waitFor(() => expect(mockMigrate).toHaveBeenCalledWith(mockSqliteDb));
    expect(mockSetAuthDb).toHaveBeenCalledWith(mockDrizzle);
    expect(mockBindDatabase).toHaveBeenCalledWith(mockDrizzle);
    expect(mockCreateClientSettings).toHaveBeenCalledWith(mockDrizzle, {
      localUsername: 'Bob',
      language: 'en',
      darkMode: false,
      use24HourTime: true,
      dateDisplayFormat: 'iso',
      showContextualHelp: true,
      suggestLiteraryDevices: true,
      showTutorials: true,
    });
    expect(mockInitializeSettings).toHaveBeenCalledWith(mockDrizzle);
    expect(mockInitializeTheme).toHaveBeenCalledWith(mockDrizzle);
    expect(mockReplace).toHaveBeenCalledWith('StorySelection');
  });

  it('exits only on a double back press', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');
    expect(mockBackHandler.current?.()).toBe(true);
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith('press_back_again_to_exit', 'info');
    expect(mockBackHandler.current?.()).toBe(true);
    expect(BackHandler.exitApp).toHaveBeenCalledTimes(1);
  });
});
