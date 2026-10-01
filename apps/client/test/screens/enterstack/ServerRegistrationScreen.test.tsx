const mockT = (key: string) => key;
// Stable identity: screens list `t` in effect deps, a fresh object per render loops forever.
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockRoute: { params?: { serverId?: string } } = { params: {} };
const mockNavigation = {
  goBack: (...args: unknown[]) => mockGoBack(...args),
  navigate: (...args: unknown[]) => mockNavigate(...args),
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
}));

jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('../../../src/services/ServerService', () => {
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

jest.mock('../../../src/services/AuthTokenManager', () => ({
  authTokenManager: {
    getTokens: (...args: unknown[]) => mockGetTokens(...args),
    updateTokens: (...args: unknown[]) => mockUpdateTokens(...args),
  },
}));

jest.mock('../../../src/services/AuthApiService', () => ({
  redeemRecoveryCode: (...args: unknown[]) => mockRedeem(...args),
}));

jest.mock('../../../src/services/browserCookieSession', () => ({
  usesHttpOnlyCookieSession: () => mockCookie.hosted,
  hostedApiOrigin: () => mockCookie.origin,
}));

jest.mock('../../../src/utils/keresServerAuth', () => ({
  authenticateWithKeresServer: (...args: unknown[]) => mockAuthenticate(...args),
  keresAuthAlertMessage: () => 'auth-failed-message',
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
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

jest.mock('../../../src/components/features/servers/ServerRegistrationFields', () => {
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

jest.mock('../../../src/components/features/servers/ServerRecoveryCodesPanel', () => {
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
import ServerRegistrationScreen from '../../../src/screens/enterstack/ServerRegistrationScreen';

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
      '../../../src/services/ServerService',
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
});
