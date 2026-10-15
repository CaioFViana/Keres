const mockT = (key: string) => key;
// Stable identity: screens list `t` in effect deps, a fresh object per render loops forever.
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockRoute: { params?: { serverId?: string } } = { params: {} };
const mockReplace = jest.fn();
const mockNavigation = {
  goBack: (...args: unknown[]) => mockGoBack(...args),
  navigate: (...args: unknown[]) => mockNavigate(...args),
  replace: (...args: unknown[]) => mockReplace(...args),
};
const mockDrizzle = {};
const mockServerService = {
  getServerById: jest.fn(),
  getServerByUrl: jest.fn(),
  createServer: jest.fn(),
  updateServer: jest.fn(),
  deleteServer: jest.fn(),
};
const mockGetTokens = jest.fn();
const mockUpdateTokens = jest.fn();
const mockAuthenticate = jest.fn();
const mockRedeem = jest.fn();
const mockSetActiveServer = jest.fn();
const mockSetTheme = jest.fn();
const mockCookie = { hosted: false, origin: null as string | null };
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
};
const mockUserSettings = {
  userId: 'user-1',
  setActiveServer: (...args: unknown[]) => mockSetActiveServer(...args),
};

jest.mock('react-i18next', () => ({
  useTranslation: () => mockI18n,
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
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
}));

jest.mock('@/src/state/ui/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('@/src/services/servers/ServerService', () => {
  class ServerHasOwnedStoriesError extends Error {
    ownedStories: Array<{ title: string }>;
    constructor(ownedStories: Array<{ title: string }>) {
      super('has owned stories');
      this.ownedStories = ownedStories;
    }
  }
  class ServerUrlAlreadyRegisteredError extends Error {}
  return {
    ServerHasOwnedStoriesError,
    ServerUrlAlreadyRegisteredError,
    createServerService: () => mockServerService,
  };
});

jest.mock('@/src/services/auth/AuthTokenManager', () => ({
  authTokenManager: {
    getTokens: (...args: unknown[]) => mockGetTokens(...args),
    updateTokens: (...args: unknown[]) => mockUpdateTokens(...args),
  },
}));

jest.mock('@/src/services/api/AuthApiService', () => ({
  redeemRecoveryCode: (...args: unknown[]) => mockRedeem(...args),
}));

const mockFetchAgeInfo = jest.fn();
const mockFetchVerificationStatus = jest.fn();
jest.mock('@/src/services/api/AgeVerificationApiService', () => ({
  __esModule: true,
  fetchAgeVerificationInfo: (...args: unknown[]) => mockFetchAgeInfo(...args),
  fetchVerificationStatus: (...args: unknown[]) => mockFetchVerificationStatus(...args),
}));

jest.mock('@/src/services/auth/browserCookieSession', () => ({
  usesHttpOnlyCookieSession: () => mockCookie.hosted,
  hostedApiOrigin: () => mockCookie.origin,
}));

jest.mock('@/src/services/auth/keresServerAuth', () => ({
  authenticateWithKeresServer: (...args: unknown[]) => mockAuthenticate(...args),
  keresAuthAlertMessage: () => 'auth-failed-message',
}));

const mockFetchServerTerms = jest.fn();
const mockFetchServerPrivacy = jest.fn();
jest.mock('@/src/services/servers/ServerTermsService', () => ({
  fetchServerTerms: (...args: unknown[]) => mockFetchServerTerms(...args),
  fetchServerPrivacy: (...args: unknown[]) => mockFetchServerPrivacy(...args),
}));

jest.mock('@/src/state/app/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockUserSettings) : mockUserSettings,
}));

type FieldsProps = {
  serverId?: string;
  mode: string;
  onModeChange: (mode: 'login' | 'register' | 'recover') => void;
  onServerAddressChange: (value: string) => void;
  onServerNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onRecoveryCodeChange: (value: string) => void;
  serverAddress: string;
  username: string;
};

jest.mock('@/src/components/features/servers/ServerRegistrationFields', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: FieldsProps) => (
      <>
        <Text testID="reg-fields">
          {JSON.stringify({
            serverId: props.serverId ?? null,
            mode: props.mode,
            address: props.serverAddress,
            username: props.username,
          })}
        </Text>
        <Text testID="set-mode-register" onPress={() => props.onModeChange('register')}>
          to-register
        </Text>
        <Text testID="set-mode-recover" onPress={() => props.onModeChange('recover')}>
          to-recover
        </Text>
        <Text testID="set-address" onPress={() => props.onServerAddressChange('https://s.example')}>
          set-address
        </Text>
        <Text testID="set-username" onPress={() => props.onUsernameChange('alice')}>
          set-username
        </Text>
        <Text testID="set-password" onPress={() => props.onPasswordChange('password123')}>
          set-password
        </Text>
        <Text testID="set-password-short" onPress={() => props.onPasswordChange('short')}>
          set-password-short
        </Text>
        <Text testID="set-confirm" onPress={() => props.onConfirmPasswordChange('password123')}>
          set-confirm
        </Text>
        <Text testID="set-confirm-other" onPress={() => props.onConfirmPasswordChange('different')}>
          set-confirm-other
        </Text>
        <Text testID="set-recovery" onPress={() => props.onRecoveryCodeChange('RC-1')}>
          set-recovery
        </Text>
        <Text testID="set-name" onPress={() => props.onServerNameChange('My Server')}>
          set-name
        </Text>
      </>
    ),
  };
});

jest.mock('@/src/components/features/servers/ServerRecoveryCodesPanel', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ codes, onContinue }: { codes: string[]; onContinue: () => void }) => (
      <>
        <Text testID="recovery-panel">{codes.join(',')}</Text>
        <Text testID="recovery-continue" onPress={onContinue}>
          continue
        </Text>
      </>
    ),
  };
});

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import ServerRegistrationScreen from '@/src/screens/enterstack/ServerRegistrationScreen';

const existingServer = {
  id: 'srv-1',
  url: 'https://old.example',
  userName: 'alice',
  name: 'Old',
  idUser: 'user-on-server',
  tag: 'alice',
};

const authOk = {
  ok: true,
  userId: 'user-on-server',
  tag: 'alice',
  tokensChanged: true,
  accessToken: 'at',
  refreshToken: 'rt',
};

async function fillLogin(view: { getByTestId: (id: string) => unknown }) {
  const get = view.getByTestId as (id: string) => Parameters<typeof fireEvent.press>[0];
  await fireEvent.press(get('set-address'));
  await fireEvent.press(get('set-username'));
  await fireEvent.press(get('set-password'));
}

describe('ServerRegistrationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = {};
    mockCookie.hosted = false;
    mockCookie.origin = null;
    mockServerService.getServerById.mockResolvedValue(null);
    mockServerService.getServerByUrl.mockResolvedValue(null);
    mockServerService.createServer.mockResolvedValue({ id: 'srv-new', url: 'https://s.example' });
    mockServerService.updateServer.mockResolvedValue(undefined);
    mockServerService.deleteServer.mockResolvedValue(undefined);
    mockGetTokens.mockResolvedValue(null);
    mockAuthenticate.mockResolvedValue(authOk);
    mockRedeem.mockResolvedValue({ success: false, reason: 'invalid_code' });
    // Servers without the terms route simply have none to agree to.
    mockFetchServerTerms.mockResolvedValue(null);
    mockFetchServerPrivacy.mockResolvedValue(null);
    // A server that predates the age check, and a login that is not of a pending account.
    mockFetchAgeInfo.mockResolvedValue(null);
    mockFetchVerificationStatus.mockResolvedValue({ status: 'not_required' });
  });

  afterEach(() => {
    cleanup();
  });

  it('blocks saving with empty required fields', async () => {
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fireEvent.press(view.getByText('register_server'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'all_fields_required_except_password_for_edit');
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('requires a password for new registrations', async () => {
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fireEvent.press(view.getByTestId('set-address'));
    await fireEvent.press(view.getByTestId('set-username'));
    await fireEvent.press(view.getByText('register_server'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'password_required_for_registration');
  });

  it('rejects an already registered server url', async () => {
    mockServerService.getServerByUrl.mockResolvedValue({ id: 'srv-dup' });
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fillLogin(view);
    await fireEvent.press(view.getByText('register_server'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'server_url_already_registered');
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('validates password length and confirmation in register mode', async () => {
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fireEvent.press(view.getByTestId('set-mode-register'));
    await fireEvent.press(view.getByTestId('set-address'));
    await fireEvent.press(view.getByTestId('set-username'));
    await fireEvent.press(view.getByTestId('set-password-short'));
    await fireEvent.press(view.getByTestId('set-confirm'));
    await fireEvent.press(view.getByText('create_account'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'new_password_too_short');

    await fireEvent.press(view.getByTestId('set-password'));
    await fireEvent.press(view.getByTestId('set-confirm-other'));
    await fireEvent.press(view.getByText('create_account'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'passwords_do_not_match');
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('registers a new server on successful login', async () => {
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fillLogin(view);
    await fireEvent.press(view.getByTestId('set-name'));
    await fireEvent.press(view.getByText('register_server'));
    await waitFor(() => expect(mockServerService.createServer).toHaveBeenCalled());
    expect(mockServerService.createServer).toHaveBeenCalledWith(
      expect.objectContaining({
        idUser: 'user-on-server',
        userName: 'alice',
        tag: 'alice',
        name: 'My Server',
        url: 'https://s.example',
      }),
    );
    expect(mockUpdateTokens).toHaveBeenCalledWith('srv-new', 'at', 'rt');
    expect(mockSetActiveServer).toHaveBeenCalledWith(expect.objectContaining({ id: 'srv-new' }));
    expect(mockAlert).toHaveBeenCalledWith('success', 'server_registered_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('asks for the server terms before creating an account, and saves the agreed copy', async () => {
    mockFetchServerTerms.mockResolvedValue({
      version: 3,
      updatedAt: '2026-10-12',
      sections: [{ heading: 'Rules', paragraphs: ['Be kind.'] }],
      text: 'Rules\nBe kind.',
    });
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fireEvent.press(view.getByTestId('set-mode-register'));
    await fillLogin(view);
    await fireEvent.press(view.getByTestId('set-password'));
    await fireEvent.press(view.getByTestId('set-confirm'));
    await fireEvent.press(view.getByTestId('server-register-adult-switch'));
    await fireEvent.press(view.getByText('create_account'));

    // Nothing is written before agreement: no auth, no server row.
    await view.findByTestId('server-terms-modal-scroll');
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockServerService.createServer).not.toHaveBeenCalled();
    // Agreement is gated on reading to the end: pressing early changes nothing.
    expect(view.queryByText('terms_scroll_to_accept')).toBeTruthy();
    await fireEvent.press(view.getByTestId('server-terms-modal-accept'));
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockServerService.createServer).not.toHaveBeenCalled();

    await fireEvent(view.getByTestId('server-terms-modal-scroll'), 'onScroll', {
      nativeEvent: {
        contentSize: { height: 1000 },
        layoutMeasurement: { height: 200 },
        contentOffset: { y: 100 },
      },
    });
    await fireEvent.press(view.getByTestId('server-terms-modal-accept'));
    expect(mockServerService.createServer).not.toHaveBeenCalled();

    await fireEvent(view.getByTestId('server-terms-modal-scroll'), 'onScroll', {
      nativeEvent: {
        contentSize: { height: 1000 },
        layoutMeasurement: { height: 200 },
        contentOffset: { y: 800 },
      },
    });
    expect(view.queryByText('terms_scroll_to_accept')).toBeNull();
    await fireEvent.press(view.getByTestId('server-terms-modal-accept'));

    await waitFor(() => expect(mockServerService.createServer).toHaveBeenCalled());
    expect(mockServerService.createServer).toHaveBeenCalledWith(
      expect.objectContaining({
        tosText: 'Rules\nBe kind.',
        tosVersion: '3',
        tosAcceptedAt: expect.any(Date),
      }),
    );
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('asks for the privacy policy after the terms, and saves the agreed copy', async () => {
    mockFetchServerTerms.mockResolvedValue(null);
    mockFetchServerPrivacy.mockResolvedValue({
      version: 1,
      updatedAt: '2026-10-12',
      sections: [{ heading: 'Privacy', paragraphs: ['We keep little.'] }],
      text: 'Privacy\nWe keep little.',
    });
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fireEvent.press(view.getByTestId('set-mode-register'));
    await fillLogin(view);
    await fireEvent.press(view.getByTestId('set-password'));
    await fireEvent.press(view.getByTestId('set-confirm'));
    await fireEvent.press(view.getByTestId('server-register-adult-switch'));
    await fireEvent.press(view.getByText('create_account'));

    await view.findByTestId('server-privacy-modal-scroll');
    expect(mockServerService.createServer).not.toHaveBeenCalled();

    await fireEvent(view.getByTestId('server-privacy-modal-scroll'), 'onScroll', {
      nativeEvent: {
        contentSize: { height: 1000 },
        layoutMeasurement: { height: 200 },
        contentOffset: { y: 800 },
      },
    });
    await fireEvent.press(view.getByTestId('server-privacy-modal-accept'));

    await waitFor(() => expect(mockServerService.createServer).toHaveBeenCalled());
    expect(mockServerService.createServer).toHaveBeenCalledWith(
      expect.objectContaining({
        privacyText: 'Privacy\nWe keep little.',
        privacyVersion: '1',
        privacyAcceptedAt: expect.any(Date),
      }),
    );
  });

  it('requires confirming 18+ before creating an account', async () => {
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fireEvent.press(view.getByTestId('set-mode-register'));
    await fillLogin(view);
    await fireEvent.press(view.getByTestId('set-password'));
    await fireEvent.press(view.getByTestId('set-confirm'));
    await fireEvent.press(view.getByText('create_account'));

    expect(mockAlert).toHaveBeenCalledWith('error', 'server_register_adult_required');
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockFetchServerTerms).not.toHaveBeenCalled();
    expect(mockServerService.createServer).not.toHaveBeenCalled();

    await fireEvent.press(view.getByTestId('server-register-adult-switch'));
    await fireEvent.press(view.getByText('create_account'));
    await waitFor(() => expect(mockServerService.createServer).toHaveBeenCalled());
  });

  it('registers without terms when the server predates the terms route', async () => {
    mockFetchServerTerms.mockResolvedValue(null);
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fireEvent.press(view.getByTestId('set-mode-register'));
    await fillLogin(view);
    await fireEvent.press(view.getByTestId('set-password'));
    await fireEvent.press(view.getByTestId('set-confirm'));
    await fireEvent.press(view.getByTestId('server-register-adult-switch'));
    await fireEvent.press(view.getByText('create_account'));

    await waitFor(() => expect(mockServerService.createServer).toHaveBeenCalled());
    const saved = mockServerService.createServer.mock.calls[0][0] as Record<string, unknown>;
    expect(saved.tosText).toBeUndefined();
    expect(saved.tosVersion).toBeUndefined();
    expect(view.queryByTestId('server-terms-modal-scroll')).toBeNull();
  });

  it('shows the auth failure message without saving', async () => {
    mockAuthenticate.mockResolvedValue({ ok: false, reason: 'bad-credentials' });
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fillLogin(view);
    await fireEvent.press(view.getByText('register_server'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'auth-failed-message'));
    expect(mockServerService.createServer).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('shows recovery codes after registration and continues back', async () => {
    mockAuthenticate.mockResolvedValue({ ...authOk, recoveryCodes: ['c1', 'c2'] });
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fillLogin(view);
    await fireEvent.press(view.getByText('register_server'));
    await view.findByTestId('recovery-panel');
    expect(view.getByTestId('recovery-panel').props.children).toBe('c1,c2');
    expect(mockGoBack).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('recovery-continue'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('loads and updates an existing server', async () => {
    mockRoute.params = { serverId: 'srv-1' };
    mockServerService.getServerById.mockResolvedValue(existingServer);
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('update_server');
    const marker = JSON.parse(view.getByTestId('reg-fields').props.children as string);
    expect(marker.serverId).toBe('srv-1');
    await fireEvent.press(view.getByText('update_server'));
    await waitFor(() => expect(mockServerService.updateServer).toHaveBeenCalled());
    expect(mockAlert).toHaveBeenCalledWith('success', 'server_updated_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows the error screen when the edited server is missing', async () => {
    mockRoute.params = { serverId: 'srv-missing' };
    mockServerService.getServerById.mockResolvedValue(null);
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('server_not_found');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('deletes the server after confirmation', async () => {
    mockRoute.params = { serverId: 'srv-1' };
    mockServerService.getServerById.mockResolvedValue(existingServer);
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('delete_server');
    await fireEvent.press(view.getByText('delete_server'));
    expect(mockAlert).toHaveBeenCalledWith(
      'delete_server_title',
      'delete_server_message',
      expect.any(Array),
    );
    const buttons = mockAlert.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => Promise<void>;
    }>;
    const del = buttons.find((b) => b.text === 'delete');
    expect(del?.onPress).toBeDefined();
    await act(async () => {
      await del?.onPress?.();
    });
    await waitFor(() => expect(mockServerService.deleteServer).toHaveBeenCalledWith('srv-1'));
    expect(mockAlert).toHaveBeenCalledWith('success', 'server_deleted_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('recovers access with a recovery code', async () => {
    mockRedeem.mockResolvedValue({
      success: true,
      result: { userId: 'user-on-server', tag: 'alice', accessToken: 'at', refreshToken: 'rt' },
    });
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fireEvent.press(view.getByTestId('set-mode-recover'));
    await view.findByText('reset_password_button');
    await fireEvent.press(view.getByTestId('set-address'));
    await fireEvent.press(view.getByTestId('set-username'));
    await fireEvent.press(view.getByTestId('set-recovery'));
    await fireEvent.press(view.getByTestId('set-password'));
    await fireEvent.press(view.getByTestId('set-confirm'));
    await fireEvent.press(view.getByText('reset_password_button'));
    await waitFor(() => expect(mockServerService.createServer).toHaveBeenCalled());
    expect(mockUpdateTokens).toHaveBeenCalledWith('srv-new', 'at', 'rt');
    expect(mockAlert).toHaveBeenCalledWith('success', 'password_reset_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('reports an invalid recovery code', async () => {
    mockRedeem.mockResolvedValue({ success: false, reason: 'invalid_code' });
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fireEvent.press(view.getByTestId('set-mode-recover'));
    await view.findByText('reset_password_button');
    await fireEvent.press(view.getByTestId('set-address'));
    await fireEvent.press(view.getByTestId('set-username'));
    await fireEvent.press(view.getByTestId('set-recovery'));
    await fireEvent.press(view.getByTestId('set-password'));
    await fireEvent.press(view.getByTestId('set-confirm'));
    await fireEvent.press(view.getByText('reset_password_button'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'recovery_code_invalid'));
    expect(mockServerService.createServer).not.toHaveBeenCalled();
  });

  it('surfaces save failures on the form', async () => {
    const { ServerUrlAlreadyRegisteredError } = jest.requireMock(
      '@/src/services/servers/ServerService',
    ) as { ServerUrlAlreadyRegisteredError: new () => Error };
    mockServerService.createServer.mockRejectedValue(new ServerUrlAlreadyRegisteredError());
    const view = await render(<ServerRegistrationScreen />);
    await view.findByText('register_server');
    await fillLogin(view);
    await fireEvent.press(view.getByText('register_server'));
    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith('error', 'server_url_already_registered'),
    );
    expect(view.getByText('server_url_already_registered')).toBeTruthy();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  describe('age verification', () => {
    const pendingVerification = {
      status: 'pending',
      action: { kind: 'redirect', url: 'https://verify.example/v/token' },
    };

    /** The registration form filled in and the 18+ confirmation on, ready to create the account. */
    async function fillRegistration(view: Awaited<ReturnType<typeof render>>) {
      await fireEvent.press(view.getByTestId('set-mode-register'));
      await fillLogin(view);
      await fireEvent.press(view.getByTestId('set-password'));
      await fireEvent.press(view.getByTestId('set-confirm'));
      await fireEvent.press(view.getByTestId('server-register-adult-switch'));
    }

    it('blocks the registration when the server requires verification and cannot run it', async () => {
      mockFetchAgeInfo.mockResolvedValue({ mode: 'required', available: false });
      const view = await render(<ServerRegistrationScreen />);
      await view.findByText('register_server');
      await fillRegistration(view);
      await fireEvent.press(view.getByText('create_account'));

      expect(mockFetchAgeInfo).toHaveBeenCalledWith('https://s.example');
      expect(mockAlert).toHaveBeenCalledWith('error', 'age_verification_unavailable');
      expect(view.getAllByText('age_verification_unavailable').length).toBeGreaterThan(0);
      expect(mockFetchServerTerms).not.toHaveBeenCalled();
      expect(mockAuthenticate).not.toHaveBeenCalled();
      expect(mockServerService.createServer).not.toHaveBeenCalled();
    });

    it('says where the documents go on a server that verifies, beside the 18+ confirmation', async () => {
      mockFetchAgeInfo.mockResolvedValue({ mode: 'required', available: true });
      const view = await render(<ServerRegistrationScreen />);
      await view.findByText('register_server');
      await fillRegistration(view);

      expect(await view.findByText('age_verification_required_notice')).toBeTruthy();
      expect(mockAuthenticate).not.toHaveBeenCalled();
    });

    it('says a manual server has no automated check, without stopping the registration', async () => {
      mockFetchAgeInfo.mockResolvedValue({ mode: 'manual', available: false });
      const view = await render(<ServerRegistrationScreen />);
      await view.findByText('register_server');
      await fillRegistration(view);

      expect(await view.findByText('age_verification_manual_notice')).toBeTruthy();
      await fireEvent.press(view.getByText('create_account'));
      await waitFor(() => expect(mockServerService.createServer).toHaveBeenCalled());
      expect(mockAlert).not.toHaveBeenCalledWith('error', 'age_verification_unavailable');
    });

    it('does not stop the registration when the age check cannot be read', async () => {
      mockFetchAgeInfo.mockResolvedValue(null);
      const view = await render(<ServerRegistrationScreen />);
      await view.findByText('register_server');
      await fillRegistration(view);
      await fireEvent.press(view.getByText('create_account'));

      await waitFor(() => expect(mockServerService.createServer).toHaveBeenCalled());
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    });

    it("registers in the app's language, so the verification page follows the app and not the browser", async () => {
      mockFetchAgeInfo.mockResolvedValue({ mode: 'required', available: true });
      mockI18n.i18n.language = 'pt-BR';
      try {
        const view = await render(<ServerRegistrationScreen />);
        await view.findByText('register_server');
        await fillRegistration(view);
        await fireEvent.press(view.getByText('create_account'));

        await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1));
        expect(mockAuthenticate).toHaveBeenCalledWith(
          expect.objectContaining({ isRegistering: true, language: 'pt-BR' }),
        );
      } finally {
        mockI18n.i18n.language = 'en';
      }
    });

    it('shows the recovery codes of a pending account first, then goes to the verification screen', async () => {
      mockAuthenticate.mockResolvedValue({
        ...authOk,
        recoveryCodes: ['c1', 'c2'],
        verification: pendingVerification,
      });
      const view = await render(<ServerRegistrationScreen />);
      await view.findByText('register_server');
      await fillRegistration(view);
      await fireEvent.press(view.getByText('create_account'));

      await view.findByTestId('recovery-panel');
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockGoBack).not.toHaveBeenCalled();
      // A pending account is not made the active server: its session would only be refused by the sync.
      expect(mockSetActiveServer).not.toHaveBeenCalled();
      await fireEvent.press(view.getByTestId('recovery-continue'));
      expect(mockReplace).toHaveBeenCalledWith('ServerVerification', { serverId: 'srv-new' });
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it('keeps the old flow for a registration answer without verification', async () => {
      mockAuthenticate.mockResolvedValue({ ...authOk, recoveryCodes: ['c1'] });
      const view = await render(<ServerRegistrationScreen />);
      await view.findByText('register_server');
      await fillRegistration(view);
      await fireEvent.press(view.getByText('create_account'));

      await view.findByTestId('recovery-panel');
      await fireEvent.press(view.getByTestId('recovery-continue'));
      expect(mockGoBack).toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockSetActiveServer).toHaveBeenCalledWith(expect.objectContaining({ id: 'srv-new' }));
    });

    it.each(['pending', 'rejected', 'expired'])(
      'sends a login of an account that is %s to the verification screen, not as an active server',
      async (status) => {
        mockFetchVerificationStatus.mockResolvedValue({ status });
        const view = await render(<ServerRegistrationScreen />);
        await view.findByText('register_server');
        await fillLogin(view);
        await fireEvent.press(view.getByText('register_server'));

        await waitFor(() =>
          expect(mockReplace).toHaveBeenCalledWith('ServerVerification', { serverId: 'srv-new' }),
        );
        expect(mockFetchVerificationStatus).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'srv-new' }),
        );
        expect(mockGoBack).not.toHaveBeenCalled();
        expect(mockSetActiveServer).not.toHaveBeenCalled();
      },
    );

    it('keeps a login of an account that needs no verification as it was', async () => {
      mockFetchVerificationStatus.mockResolvedValue({ status: 'not_required' });
      const view = await render(<ServerRegistrationScreen />);
      await view.findByText('register_server');
      await fillLogin(view);
      await fireEvent.press(view.getByText('register_server'));

      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockSetActiveServer).toHaveBeenCalledWith(expect.objectContaining({ id: 'srv-new' }));
    });

    it('keeps a login going when the server has no verification route to ask', async () => {
      mockFetchVerificationStatus.mockRejectedValue(new Error('not found'));
      const view = await render(<ServerRegistrationScreen />);
      await view.findByText('register_server');
      await fillLogin(view);
      await fireEvent.press(view.getByText('register_server'));

      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
