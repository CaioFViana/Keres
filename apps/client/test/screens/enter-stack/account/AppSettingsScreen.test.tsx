import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { withSilencedConsole } from '@/test/helpers/silenceConsole';
import SettingsScreen from '@/src/screens/enter-stack/account/AppSettingsScreen';
import { getAcceptedClientLegal, setAcceptedClientLegal } from '@/src/legal/clientTermsAcceptance';
import { useMusicToolsStore } from '@/src/state/drafts/musicToolsStore';

const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockDispatch = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = {
  dispatch: (...args: unknown[]) => mockDispatch(...args),
  navigate: (...args: unknown[]) => mockNavigate(...args),
};
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
const mockSetShowTutorials = jest.fn();
const mockSetWarnPaymentDue = jest.fn();
const mockSetAllowCommunityServers = jest.fn();
const mockResetSeenTutorials = jest.fn();
const mockResetSettings = jest.fn();
const mockUserSettings = {
  username: 'Bob',
  language: 'en',
  use24HourTime: true,
  dateDisplayFormat: 'iso',
  showContextualHelp: true,
  suggestLiteraryDevices: false,
  exportFormat: 'svg',
  showTutorials: true,
  warnPaymentDue: true,
  allowCommunityServers: false,
  setUsername: (...args: unknown[]) => mockSetUsername(...args),
  setLanguage: (...args: unknown[]) => mockSetLanguage(...args),
  setUse24HourTime: (...args: unknown[]) => mockSetUse24HourTime(...args),
  setDateDisplayFormat: (...args: unknown[]) => mockSetDateDisplayFormat(...args),
  setShowContextualHelp: (...args: unknown[]) => mockSetShowContextualHelp(...args),
  setSuggestLiteraryDevices: (...args: unknown[]) => mockSetSuggestLiteraryDevices(...args),
  setExportFormat: (...args: unknown[]) => mockSetExportFormat(...args),
  setShowTutorials: (...args: unknown[]) => mockSetShowTutorials(...args),
  setWarnPaymentDue: (...args: unknown[]) => mockSetWarnPaymentDue(...args),
  setAllowCommunityServers: (...args: unknown[]) => mockSetAllowCommunityServers(...args),
  resetSeenTutorials: (...args: unknown[]) => mockResetSeenTutorials(...args),
  resetSettings: (...args: unknown[]) => mockResetSettings(...args),
};
const mockShowNotification = jest.fn();
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

jest.mock('@/src/theme', () => {
  const actual = jest.requireActual('@/src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: mockSetTheme, colors: mockColors }),
  };
});

jest.mock('@/src/hooks/nav/useScreenHeader', () => ({
  useScreenHeader: () => {},
}));

jest.mock('@/src/hooks/nav/useBackButtonHandler', () => ({
  useBackButtonHandler: () => {},
}));

jest.mock('@/src/hooks/forms/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 20,
}));

jest.mock('@/src/db', () => ({
  useDrizzle: () => mockDrizzle,
  resetDatabase: (...args: unknown[]) => mockResetDatabase(...args),
}));

let mockServerless = false;
let mockHosted = false;
jest.mock('@/src/utils/platform/clientFlavor', () => ({
  ...jest.requireActual('@/src/utils/platform/clientFlavor'),
  isServerless: () => mockServerless,
  isHostedByApi: () => mockHosted,
}));

jest.mock('@/src/state/ui/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('@/src/services/auth/AuthTokenManager', () => ({
  authTokenManager: {
    clearAllAuth: (...args: unknown[]) => mockClearAllAuth(...args),
  },
  setAuthDb: (...args: unknown[]) => mockSetAuthDb(...args),
}));

// The screen reads the real font pack state; only what the reset deletes is replaced.
jest.mock('@/src/services/platform-web/cjkFontPack', () => ({
  ...jest.requireActual('@/src/services/platform-web/cjkFontPack'),
  deleteCjkPack: jest.fn(async () => undefined),
}));
jest.mock('@/src/services/media/SongAudioService', () => ({
  ...jest.requireActual('@/src/services/media/SongAudioService'),
  defaultSongAudioStore: () => ({ prune: jest.fn(async () => undefined) }),
}));
jest.mock('@/src/services/media/MediaFileService', () => ({
  mediaFileService: {
    deleteAllMedia: (...args: unknown[]) => mockDeleteAllMedia(...args),
  },
}));

jest.mock('@/src/services/sync/appSyncEngine', () => ({
  syncEngine: { reset: (...args: unknown[]) => mockSyncReset(...args) },
}));

jest.mock('@/src/state/resetAllClientStores', () => ({
  resetAllClientStores: (...args: unknown[]) => mockResetAllClientStores(...args),
}));

jest.mock('@/src/state/app/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockUserSettings) : mockUserSettings,
}));

jest.mock('@/src/state/ui/themeStore', () => ({
  useThemeStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockThemeState) : mockThemeState,
}));

jest.mock('@/src/state/ui/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) => {
    const state = { showNotification: (...args: unknown[]) => mockShowNotification(...args) };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('@/src/utils/format/i18n', () => ({
  __esModule: true,
  default: { changeLanguage: (...args: unknown[]) => mockChangeLanguage(...args) },
  getLanguageOptions: () => [
    { label: 'English', value: 'en' },
    { label: 'Português', value: 'pt' },
  ],
}));

type PillProps = {
  options: { label: string; value: string }[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder: string;
};

jest.mock('@/src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
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

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

describe('AppSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServerless = false;
    mockHosted = false;
    mockUserSettings.allowCommunityServers = false;
    jest.spyOn(console, 'log').mockImplementation((() => undefined) as never);
    mockSelectAll.mockResolvedValue([{ id: 'srv-1' }]);
    mockResetDatabase.mockResolvedValue(undefined);
    mockClearAllAuth.mockResolvedValue(undefined);
    mockDeleteAllMedia.mockResolvedValue(undefined);
    mockSyncReset.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await cleanup();
    (console.log as jest.Mock).mockRestore();
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
    expect(view.getByText('show_tutorials_on')).toBeTruthy();
    expect(view.getByText('reset_seen_tutorials')).toBeTruthy();
    expect(view.getByText('reset_application')).toBeTruthy();
    expect(view.getByText(/Keres/)).toBeTruthy();
    expect(view.getByTestId('pill-select_language').props.children).toBe('select_language:en');
  });

  it('groups the settings under titles, the destructive ones last', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('username');

    const titles = view.getAllByRole('header').map((node) => node.props.children);
    expect(titles).toEqual([
      'settings_section_profile',
      'settings_section_appearance',
      'settings_section_assistance',
      'settings_section_exports',
      'settings_section_data',
    ]);
    expect(view.getByText('settings_reset_application_hint')).toBeTruthy();
  });

  it('reads the app terms from Settings', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByLabelText('settings_terms');

    await fireEvent.press(view.getByLabelText('settings_terms'));
    await view.findByTestId('settings-terms-modal-scroll');
    expect(view.getByTestId('settings-terms-modal-accept')).toBeTruthy();
  });

  it('reads the privacy policy from Settings', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByLabelText('settings_privacy');

    await fireEvent.press(view.getByLabelText('settings_privacy'));
    await view.findByTestId('settings-privacy-modal-scroll');
    expect(view.getByTestId('settings-privacy-modal-accept')).toBeTruthy();
  });

  it('opens the credits screen from the Keres emblem', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByLabelText('credits_open_credits');

    await fireEvent.press(view.getByLabelText('credits_open_credits'));

    expect(mockNavigate).toHaveBeenCalledWith('Credits');
  });

  it('updates the username', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('username');
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), 'Alice');
    expect(mockSetUsername).toHaveBeenCalledWith(mockDrizzle, 'Alice');
  });

  it('saves the name without the spaces around it, as the first-run setup does', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('username');
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), '  Alice ');
    expect(mockSetUsername).toHaveBeenCalledWith(mockDrizzle, 'Alice');
  });

  it('lets the field be emptied to rewrite it, but never saves it empty and says why', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('username');
    expect(view.queryByText('username_required_error')).toBeNull();

    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), '   ');

    expect(mockSetUsername).not.toHaveBeenCalled();
    expect(view.getByText('username_required_error')).toBeTruthy();
    expect(view.getByPlaceholderText('enter_username').props.value).toBe('   ');
  });

  it('goes back to the saved name, and drops the message, when the field is left empty', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('username');
    await fireEvent.changeText(view.getByPlaceholderText('enter_username'), '');

    await fireEvent(view.getByPlaceholderText('enter_username'), 'blur');

    expect(view.queryByText('username_required_error')).toBeNull();
    expect(view.getByPlaceholderText('enter_username').props.value).toBe('Bob');
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

  it('shows the music tools as they were kept, even when no song screen was opened since the reload', async () => {
    useMusicToolsStore.getState().reset();
    await AsyncStorage.setItem('@keres/music-tools', 'true');

    const view = await render(<SettingsScreen />);
    await view.findByText('dark_mode');

    // Nothing else asked the store to read the device: the screen did.
    await waitFor(() => expect(useMusicToolsStore.getState().enabled).toBe(true));
  });

  it('toggles the boolean settings', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('dark_mode');
    const switches = view.getAllByRole('switch');
    expect(switches).toHaveLength(8);
    await act(async () => {
      useMusicToolsStore.setState({ enabled: false });
    });
    await fireEvent.press(switches[0]);
    expect(mockSetDarkMode).toHaveBeenCalledWith(mockDrizzle, true);
    await fireEvent.press(switches[1]);
    expect(mockSetUse24HourTime).toHaveBeenCalledWith(mockDrizzle, false);
    await fireEvent.press(switches[2]);
    expect(mockSetSuggestLiteraryDevices).toHaveBeenCalledWith(mockDrizzle, true);
    await fireEvent.press(switches[3]);
    expect(useMusicToolsStore.getState().enabled).toBe(true);
    await fireEvent.press(switches[4]);
    expect(mockSetShowContextualHelp).toHaveBeenCalledWith(mockDrizzle, false);
    await fireEvent.press(switches[5]);
    expect(mockSetShowTutorials).toHaveBeenCalledWith(mockDrizzle, false);
    await fireEvent.press(switches[6]);
    expect(mockSetWarnPaymentDue).toHaveBeenCalledWith(mockDrizzle, false);
    await fireEvent.press(switches[7]);
    expect(mockSetAllowCommunityServers).toHaveBeenCalledWith(mockDrizzle, true);
  });

  it('offers the community servers switch, off at first, with what it means', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('allow_community_servers');

    expect(view.getByText('allow_community_servers_off')).toBeTruthy();
    expect(view.queryByText('allow_community_servers_on')).toBeNull();
    expect(
      view.getByTestId('allow-community-servers-switch').props.accessibilityState.checked,
    ).toBe(false);
  });

  it('says what is on when the community servers switch is on', async () => {
    mockUserSettings.allowCommunityServers = true;
    try {
      const view = await render(<SettingsScreen />);
      await view.findByText('allow_community_servers');

      expect(view.getByText('allow_community_servers_on')).toBeTruthy();
      expect(
        view.getByTestId('allow-community-servers-switch').props.accessibilityState.checked,
      ).toBe(true);
    } finally {
      mockUserSettings.allowCommunityServers = false;
    }
  });

  it('leaves the community servers switch out of a serverless build', async () => {
    mockServerless = true;
    const view = await render(<SettingsScreen />);
    await view.findByText('show_tutorials');

    expect(view.queryByText('allow_community_servers')).toBeNull();
    expect(view.queryByTestId('allow-community-servers-switch')).toBeNull();
  });

  it('leaves the community servers switch out of the hosted web client, which has one server', async () => {
    mockHosted = true;
    const view = await render(<SettingsScreen />);
    await view.findByText('show_tutorials');

    expect(view.queryByText('allow_community_servers')).toBeNull();
    expect(view.queryByTestId('allow-community-servers-switch')).toBeNull();
  });

  it('says what the payment reminder does, on and off', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByText('warn_payment_due');

    expect(view.getByText('warn_payment_due_on')).toBeTruthy();
  });

  it('leaves the payment reminder out of a build that has no servers to owe anything to', async () => {
    mockServerless = true;
    const view = await render(<SettingsScreen />);
    await view.findByText('show_tutorials');

    expect(view.queryByText('warn_payment_due')).toBeNull();
  });

  it('resets the seen tutorials and confirms', async () => {
    mockResetSeenTutorials.mockResolvedValue(undefined);
    const view = await render(<SettingsScreen />);
    await view.findByText('reset_seen_tutorials');

    await fireEvent.press(view.getByText('reset_seen_tutorials'));

    await waitFor(() => expect(mockResetSeenTutorials).toHaveBeenCalledWith(mockDrizzle));
    expect(mockShowNotification).toHaveBeenCalledWith('tutorials_reset_success', 'success');
  });

  it('changes the date format and ignores invalid values', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByTestId('pill-date_display_format-dmy');
    await fireEvent.press(view.getByTestId('pill-date_display_format-dmy'));
    expect(mockSetDateDisplayFormat).toHaveBeenCalledWith(mockDrizzle, 'dmy');
    await fireEvent.press(view.getByTestId('pill-date_display_format-bogus'));
    expect(mockSetDateDisplayFormat).toHaveBeenCalledTimes(1);
  });

  it('keeps the export format setting out of the screen (each export asks for its own)', async () => {
    const view = await render(<SettingsScreen />);
    await view.findByTestId('pill-date_display_format-dmy');
    expect(view.queryByTestId('pill-export_format-png')).toBeNull();
    expect(view.queryByText('export_format')).toBeNull();
    expect(mockSetExportFormat).not.toHaveBeenCalled();
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

  it('forgets the accepted terms and privacy policy, so the welcome asks for both again', async () => {
    await setAcceptedClientLegal('terms', 3, 'onboarding');
    await setAcceptedClientLegal('privacy', 2, 'onboarding');
    expect(await getAcceptedClientLegal('terms')).not.toBeNull();

    const view = await render(<SettingsScreen />);
    await view.findByText('reset_application');
    await fireEvent.press(view.getByText('reset_application'));
    const reset = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'reset');
    await act(async () => {
      await reset?.onPress?.();
    });
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());

    expect(await getAcceptedClientLegal('terms')).toBeNull();
    expect(await getAcceptedClientLegal('privacy')).toBeNull();
  });

  it('reports reset failures', async () => {
    await withSilencedConsole(['error'], async () => {
      mockResetDatabase.mockRejectedValue(new Error('boom'));
      const view = await render(<SettingsScreen />);
      await view.findByText('reset_application');
      await fireEvent.press(view.getByText('reset_application'));
      const reset = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'reset');
      await act(async () => {
        await reset?.onPress?.();
      });
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'reset_application_error'),
      );
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });
});
