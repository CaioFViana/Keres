import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, configure, fireEvent, render, waitFor } from '@testing-library/react-native';
import { BackHandler, Linking } from 'react-native';
import { CLIENT_TERMS_VERSION } from '@/src/legal/clientTerms';
import { CLIENT_PRIVACY_VERSION } from '@/src/legal/privacyPolicy';
import ColdInstallScreen from '@/src/screens/enter-stack/account/ColdInstallScreen';

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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockLayout = { width: 600 };
jest.mock('@/src/hooks/ui/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({
    width: mockLayout.width,
    isCompact: mockLayout.width < 768,
    isMedium: mockLayout.width >= 768 && mockLayout.width < 1100,
    isWide: mockLayout.width >= 1100,
  }),
}));

const mockFlavor = { current: 'native' as 'native' | 'desktop' | 'web' | 'serverless-web' };
jest.mock('@/src/utils/platform/clientFlavor', () => ({
  ...jest.requireActual('@/src/utils/platform/clientFlavor'),
  getClientFlavor: () => mockFlavor.current,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => mockSqliteDb,
}));

jest.mock('@/src/theme', () => {
  const actual = jest.requireActual('@/src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: mockSetTheme, colors: mockColors }),
  };
});

jest.mock('@/src/db', () => ({
  useDrizzle: () => mockDrizzle,
}));

jest.mock('@/src/db/migrate', () => ({
  migrate: (...args: unknown[]) => mockMigrate(...args),
}));

jest.mock('@/src/services/auth/AuthTokenManager', () => ({
  setAuthDb: (...args: unknown[]) => mockSetAuthDb(...args),
}));

jest.mock('@/src/services/account/ClientSettingsService', () => ({
  createClientSettings: (...args: unknown[]) => mockCreateClientSettings(...args),
}));

jest.mock('@/src/services/sync/appSyncEngine', () => ({
  syncEngine: { bindDatabase: (...args: unknown[]) => mockBindDatabase(...args) },
}));

jest.mock('@/src/state/ui/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockNotificationState) : mockNotificationState,
}));

const mockTheme = { darkMode: false };
const mockPreviewDarkMode = jest.fn((value: boolean) => {
  mockTheme.darkMode = value;
});
jest.mock('@/src/state/ui/themeStore', () => ({
  useThemeStore: (selector: (state: unknown) => unknown) =>
    selector({
      initializeTheme: (...args: unknown[]) => mockInitializeTheme(...args),
      darkMode: mockTheme.darkMode,
      previewDarkMode: (value: boolean) => mockPreviewDarkMode(value),
    }),
}));

jest.mock('@/src/state/app/userSettingsStore', () => ({
  useUserSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({ initializeSettings: (...args: unknown[]) => mockInitializeSettings(...args) }),
}));

jest.mock('@/src/utils/nav/documentTitle', () => ({
  useDocumentTitle: (...args: unknown[]) => mockUseDocumentTitle(...args),
}));

jest.mock('@/src/utils/format/i18n', () => ({
  __esModule: true,
  default: { language: 'en', changeLanguage: (...args: unknown[]) => mockChangeLanguage(...args) },
  getLanguageOptions: () => [
    { label: 'English', value: 'en' },
    { label: 'Português', value: 'pt' },
  ],
}));

jest.mock('@/src/components/common', () => {
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
      options: { label: string; value: string }[];
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

/** The step on screen, as the dots report it (1-based). */
const stepOf = (view: Awaited<ReturnType<typeof render>>) =>
  view.getByTestId('welcome-progress').props.accessibilityValue.now;

/** The welcome has two steps before the form that creates the profile. */
const goToNameStep = async (view: Awaited<ReturnType<typeof render>>) => {
  await fireEvent.press(view.getByText('enabled:welcome_next'));
  await fireEvent.press(view.getByText('enabled:welcome_next'));
};

// The scroll gate needs real measures: short content in tests never reaches the end alone.
const scrollToEnd = async (view: Awaited<ReturnType<typeof render>>, testID: string) => {
  await fireEvent.scroll(view.getByTestId(testID), {
    nativeEvent: {
      contentSize: { height: 2000, width: 400 },
      layoutMeasurement: { height: 500, width: 400 },
      contentOffset: { y: 1600, x: 0 },
    },
  });
};

const acceptLegal = async (view: Awaited<ReturnType<typeof render>>) => {
  await fireEvent.press(view.getByTestId('welcome-terms-button'));
  await view.findByTestId('welcome-terms-modal-scroll');
  await scrollToEnd(view, 'welcome-terms-modal-scroll');
  await fireEvent.press(view.getByTestId('welcome-terms-modal-accept'));
  await fireEvent.press(view.getByTestId('welcome-privacy-button'));
  await view.findByTestId('welcome-privacy-modal-scroll');
  await scrollToEnd(view, 'welcome-privacy-modal-scroll');
  await fireEvent.press(view.getByTestId('welcome-privacy-modal-accept'));
};

describe('ColdInstallScreen', () => {
  // Steps off screen are hidden from accessibility on purpose; the tests still look inside them.
  beforeAll(() => configure({ defaultIncludeHiddenElements: true }));
  afterAll(() => configure({ defaultIncludeHiddenElements: false }));

  beforeEach(async () => {
    jest.clearAllMocks();
    // Acceptance lives in the real storage mock: one test's agreement must not leak into the next.
    await AsyncStorage.clear();
    mockFlavor.current = 'native';
    mockLayout.width = 600;
    mockTheme.darkMode = false;
    mockBackHandler.current = null;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      // RN 0.86 passes a HardwareBackPressEvent the production handlers ignore; the holder
      // keeps the old zero-arg shape so the assertions below read unchanged.
      mockBackHandler.current = () => handler({ type: 'hardwareBackPress', timeStamp: 0 });
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

  it('opens on what Keres is, with the language choice already at hand', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');
    expect(view.getByText('welcome_what_title')).toBeTruthy();
    expect(view.getByText('welcome_what_plan')).toBeTruthy();
    expect(view.getByText('welcome_what_write')).toBeTruthy();
    expect(view.getByTestId('language-value')).toBeTruthy();
    expect(stepOf(view)).toBe(1);
    expect(mockUseDocumentTitle).toHaveBeenCalledWith('welcome');
  });

  it('walks the steps forward and back, ending on the form with proceed disabled', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome_what_title');
    expect(view.queryByTestId('welcome-back')).toBeNull();
    // The form is part of the last step: out of reach until the welcome gets there.
    expect(view.getByPlaceholderText('enter_username').props.editable).toBe(false);

    await fireEvent.press(view.getByText('enabled:welcome_next'));
    expect(stepOf(view)).toBe(2);

    await fireEvent.press(view.getByText('enabled:welcome_next'));
    expect(stepOf(view)).toBe(3);
    expect(view.getByText('welcome_name_explain')).toBeTruthy();
    expect(view.getByText('disabled:proceed')).toBeTruthy();
    expect(view.getByPlaceholderText('enter_username').props.editable).toBe(true);

    await fireEvent.press(view.getByTestId('welcome-back'));
    expect(stepOf(view)).toBe(2);
    expect(view.getByPlaceholderText('enter_username').props.editable).toBe(false);
  });

  it.each([
    [600, 'stacked'],
    [900, 'split'],
    [1400, 'split'],
  ])(
    'lays the welcome out %ipx wide as %s: the picture beside the text once there is room',
    async (width, layout) => {
      mockLayout.width = width;
      const view = await render(<ColdInstallScreen />);
      await view.findByText('welcome_what_title');

      expect(view.getByTestId(`welcome-screen-${layout}`)).toBeTruthy();
      // The same steps either way, with the language, the way out and the way forward in reach.
      expect(view.getByTestId('welcome-skip')).toBeTruthy();
      expect(view.getByText('enabled:welcome_next')).toBeTruthy();
      expect(view.getByTestId('welcome-progress')).toBeTruthy();
    },
  );

  it('takes a tap on a dot as a trip to that step, forward or back', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome_what_title');
    expect(view.getByTestId('welcome-dot-0').props.accessibilityState.selected).toBe(true);

    await fireEvent.press(view.getByTestId('welcome-dot-2'));
    expect(stepOf(view)).toBe(3);
    expect(view.getByTestId('welcome-dot-2').props.accessibilityState.selected).toBe(true);
    expect(view.getByPlaceholderText('enter_username').props.editable).toBe(true);

    await fireEvent.press(view.getByTestId('welcome-dot-1'));
    expect(stepOf(view)).toBe(2);
    await fireEvent.press(view.getByTestId('welcome-dot-0'));
    expect(stepOf(view)).toBe(1);
  });

  it('keeps the steps off screen out of reach of a screen reader and of a tap', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome_what_title');

    expect(view.getByTestId('welcome-page-what').props.accessibilityElementsHidden).toBe(false);
    expect(view.getByTestId('welcome-page-where').props.accessibilityElementsHidden).toBe(true);
    expect(view.getByTestId('welcome-page-where').props.pointerEvents).toBe('none');

    await fireEvent.press(view.getByText('enabled:welcome_next'));
    expect(view.getByTestId('welcome-page-where').props.accessibilityElementsHidden).toBe(false);
    expect(view.getByTestId('welcome-page-what').props.accessibilityElementsHidden).toBe(true);
  });

  it('offers dark mode from the start, shown at once and kept for the profile it creates', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');

    await fireEvent.press(view.getByTestId('welcome-dark-mode'));
    expect(mockPreviewDarkMode).toHaveBeenCalledWith(true);

    // The profile is created with the choice made on the way, not with the default.
    mockTheme.darkMode = true;
    await fireEvent.press(view.getByTestId('language-en'));
    await goToNameStep(view);
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), 'Bob');
    await acceptLegal(view);
    await fireEvent.press(view.getByText('enabled:proceed'));
    await waitFor(() => expect(mockCreateClientSettings).toHaveBeenCalled());
    expect(mockCreateClientSettings).toHaveBeenCalledWith(
      mockDrizzle,
      expect.objectContaining({ darkMode: true }),
    );
  });

  it('lets the first two steps be skipped, straight to the name', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome_what_title');

    await fireEvent.press(view.getByTestId('welcome-skip'));

    expect(stepOf(view)).toBe(3);
    expect(view.queryByTestId('welcome-skip')).toBeNull();
    expect(view.getByPlaceholderText('enter_username').props.editable).toBe(true);
  });

  it.each([
    [
      'native',
      ['welcome_where_device', 'welcome_where_offline_first', 'welcome_where_servers_how'],
      false,
    ],
    [
      'desktop',
      ['welcome_where_device', 'welcome_where_offline_first', 'welcome_where_servers_how'],
      false,
    ],
    [
      'web',
      ['welcome_where_browser', 'welcome_where_web_one_server', 'welcome_where_servers_how'],
      true,
    ],
    ['serverless-web', ['welcome_where_browser', 'welcome_where_serverless'], true],
  ] as const)(
    'says plainly where things live, in the words of the %s build',
    async (flavor, expected, hasLink) => {
      mockFlavor.current = flavor;
      const view = await render(<ColdInstallScreen />);

      const shown = [
        'welcome_where_device',
        'welcome_where_browser',
        'welcome_where_offline_first',
        'welcome_where_web_one_server',
        'welcome_where_serverless',
        'welcome_where_servers_how',
      ].filter((key) => view.queryByText(key));
      expect(shown).toEqual([...expected]);
      expect(view.queryByTestId('welcome-official-app-link') !== null).toBe(hasLink);
    },
  );

  it('points the browser builds at the latest official app, off to the side', async () => {
    mockFlavor.current = 'serverless-web';
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const view = await render(<ColdInstallScreen />);

    await fireEvent.press(view.getByTestId('welcome-official-app-link'));

    expect(openURL).toHaveBeenCalledWith('https://github.com/CaioFViana/Keres/releases/latest');
  });

  it('asks for a name before proceeding', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');
    await goToNameStep(view);
    await fireEvent.press(view.getByText('disabled:proceed'));
    expect(view.getByText('username_required_error')).toBeTruthy();
    expect(mockMigrate).not.toHaveBeenCalled();
  });

  it('holds proceed until the name is there and both documents are accepted', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');
    expect(view.getByTestId('language-value').props.children).toBe('select_language:en');
    await goToNameStep(view);
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), 'Bob');

    // A name alone no longer suffices: terms and privacy both gate the way forward.
    expect(view.getByText('disabled:proceed')).toBeTruthy();

    await fireEvent.press(view.getByTestId('welcome-terms-button'));
    await view.findByTestId('welcome-terms-modal-scroll');
    await scrollToEnd(view, 'welcome-terms-modal-scroll');
    await fireEvent.press(view.getByTestId('welcome-terms-modal-accept'));
    expect(view.getByText('disabled:proceed')).toBeTruthy();

    await fireEvent.press(view.getByTestId('welcome-privacy-button'));
    await view.findByTestId('welcome-privacy-modal-scroll');
    await scrollToEnd(view, 'welcome-privacy-modal-scroll');
    await fireEvent.press(view.getByTestId('welcome-privacy-modal-accept'));
    await fireEvent.press(view.getByText('enabled:proceed'));
    await waitFor(() => expect(mockCreateClientSettings).toHaveBeenCalled());
    expect(mockCreateClientSettings).toHaveBeenCalledWith(
      mockDrizzle,
      expect.objectContaining({ language: 'en', localUsername: 'Bob' }),
    );
  });

  it('says why proceed is shut, and drops each reason as it is met', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');
    await goToNameStep(view);

    // Nothing done yet: the three things the way forward waits for, named.
    const hint = () => view.getByTestId('welcome-proceed-hint');
    expect(hint()).toBeTruthy();
    expect(view.getByText('welcome_needs_intro')).toBeTruthy();
    expect(view.getByText('• welcome_needs_name')).toBeTruthy();
    expect(view.getByText('• welcome_needs_terms')).toBeTruthy();
    expect(view.getByText('• welcome_needs_privacy')).toBeTruthy();

    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), 'Bob');
    expect(view.queryByText('• welcome_needs_name')).toBeNull();
    expect(view.getByText('• welcome_needs_terms')).toBeTruthy();

    await fireEvent.press(view.getByTestId('welcome-terms-button'));
    await view.findByTestId('welcome-terms-modal-scroll');
    await scrollToEnd(view, 'welcome-terms-modal-scroll');
    await fireEvent.press(view.getByTestId('welcome-terms-modal-accept'));
    expect(view.queryByText('• welcome_needs_terms')).toBeNull();
    expect(view.getByText('• welcome_needs_privacy')).toBeTruthy();

    await fireEvent.press(view.getByTestId('welcome-privacy-button'));
    await view.findByTestId('welcome-privacy-modal-scroll');
    await scrollToEnd(view, 'welcome-privacy-modal-scroll');
    await fireEvent.press(view.getByTestId('welcome-privacy-modal-accept'));

    // Everything met: the button opens and the explanation is gone.
    expect(view.queryByTestId('welcome-proceed-hint')).toBeNull();
    expect(view.getByText('enabled:proceed')).toBeTruthy();
  });

  it('selects a language and enables proceed with a valid username', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');
    await fireEvent.press(view.getByTestId('language-pt'));
    expect(mockChangeLanguage).toHaveBeenCalledWith('pt');
    expect(view.getByTestId('language-value').props.children).toBe('select_language:pt');
    await goToNameStep(view);
    // The name is only how the app calls the person: anything but nothing will do.
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), '   ');
    expect(view.getByText('disabled:proceed')).toBeTruthy();
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), 'Bo');
    // The name is there, but the documents are not: forward stays shut.
    expect(view.getByText('disabled:proceed')).toBeTruthy();
  });

  it('provisions the install and opens story selection', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');
    await fireEvent.press(view.getByTestId('language-en'));
    await goToNameStep(view);
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), '  Bob ');
    await acceptLegal(view);
    await fireEvent.press(view.getByText('enabled:proceed'));
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

  it('goes back through the steps before it ever leaves', async () => {
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');
    await fireEvent.press(view.getByText('enabled:welcome_next'));
    expect(stepOf(view)).toBe(2);

    await act(async () => {
      expect(mockBackHandler.current?.()).toBe(true);
    });

    expect(stepOf(view)).toBe(1);
    expect(BackHandler.exitApp).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
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

  it('reads the app terms from the last step and records the agreement', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');
    await goToNameStep(view);

    expect(view.getByText('welcome_terms_read')).toBeTruthy();
    await fireEvent.press(view.getByTestId('welcome-terms-button'));
    await view.findByTestId('welcome-terms-modal-scroll');
    await scrollToEnd(view, 'welcome-terms-modal-scroll');
    await fireEvent.press(view.getByTestId('welcome-terms-modal-accept'));

    await waitFor(() =>
      expect(setItem).toHaveBeenCalledWith(
        '@keres/client-terms/accepted',
        expect.stringContaining(`"version":${CLIENT_TERMS_VERSION}`),
      ),
    );
    const stored = JSON.parse(
      setItem.mock.calls.find((call) => call[0] === '@keres/client-terms/accepted')?.[1] as string,
    );
    expect(stored).toMatchObject({ version: CLIENT_TERMS_VERSION, method: 'onboarding' });
    expect(typeof stored.acceptedAt).toBe('string');
    expect(view.getByText('welcome_terms_accepted')).toBeTruthy();
  });

  it('reads the privacy policy from the last step and records the agreement', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    const view = await render(<ColdInstallScreen />);
    await view.findByText('welcome');
    await goToNameStep(view);

    expect(view.getByText('welcome_privacy_read')).toBeTruthy();
    await fireEvent.press(view.getByTestId('welcome-privacy-button'));
    await view.findByTestId('welcome-privacy-modal-scroll');
    await scrollToEnd(view, 'welcome-privacy-modal-scroll');
    await fireEvent.press(view.getByTestId('welcome-privacy-modal-accept'));

    await waitFor(() =>
      expect(setItem).toHaveBeenCalledWith(
        '@keres/client-privacy/accepted',
        expect.stringContaining(`"version":${CLIENT_PRIVACY_VERSION}`),
      ),
    );
    expect(view.getByText('welcome_privacy_accepted')).toBeTruthy();
  });
});
