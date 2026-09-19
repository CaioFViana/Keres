const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockRoute: { params: { serverId: string } } = { params: { serverId: 'srv-1' } };
const mockNavigation = { goBack: (...args: unknown[]) => mockGoBack(...args) };
const mockDrizzle = {};
const mockGetServerById = jest.fn();
const mockChangeOwnPassword = jest.fn();
const mockRegenerateRecoveryCodes = jest.fn();
const mockRedeem = jest.fn();
const mockUpdateTokens = jest.fn();
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

jest.mock('../../../src/services/ServerService', () => ({
  createServerService: () => ({
    getServerById: (...args: unknown[]) => mockGetServerById(...args),
  }),
}));

jest.mock('../../../src/services/apiClient', () => ({
  __esModule: true,
  default: {},
  apiUrl: (base: string, path: string) => `${base}${path}`,
  isOfflineError: (err: unknown) => !!(err as { isOffline?: boolean } | null)?.isOffline,
}));

jest.mock('../../../src/services/UserApiService', () => ({
  userApiService: {
    changeOwnPassword: (...args: unknown[]) => mockChangeOwnPassword(...args),
    regenerateRecoveryCodes: (...args: unknown[]) => mockRegenerateRecoveryCodes(...args),
  },
}));

jest.mock('../../../src/services/AuthApiService', () => ({
  redeemRecoveryCode: (...args: unknown[]) => mockRedeem(...args),
}));

jest.mock('../../../src/services/AuthTokenManager', () => ({
  authTokenManager: {
    updateTokens: (...args: unknown[]) => mockUpdateTokens(...args),
  },
}));

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import ChangePasswordScreen from '../../../src/screens/enterstack/ChangePasswordScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const server = { id: 'srv-1', url: 'https://s.example', userName: 'alice' };

type AlertButton = { text: string; onPress?: () => Promise<void> };

function alertButtons(callIndex = 0): AlertButton[] {
  return mockAlert.mock.calls[callIndex][2] as AlertButton[];
}

describe('ChangePasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = { serverId: 'srv-1' };
    mockGetServerById.mockResolvedValue(server);
    mockChangeOwnPassword.mockResolvedValue(undefined);
    mockRegenerateRecoveryCodes.mockResolvedValue(['rc-1', 'rc-2']);
    mockRedeem.mockResolvedValue({ success: false, reason: 'invalid_code' });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the change form once the server loads', async () => {
    const view = await render(<ChangePasswordScreen />);
    await view.findByText('current_password');
    expect(view.getByText('new_password')).toBeTruthy();
    expect(view.getByText('confirm_new_password')).toBeTruthy();
    expect(view.getByText('save')).toBeTruthy();
    expect(view.getByText('forgot_current_password_link')).toBeTruthy();
    expect(view.getByText('regenerate_recovery_codes_title')).toBeTruthy();
  });

  it('shows the error screen when the server is missing', async () => {
    mockGetServerById.mockResolvedValue(null);
    const view = await render(<ChangePasswordScreen />);
    await view.findByText('server_not_found');
    await fireEvent.press(view.getByText('go_back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('validates the new password before saving', async () => {
    const view = await render(<ChangePasswordScreen />);
    await view.findByText('save');
    await fireEvent.changeText(view.getByPlaceholderText('current_password_placeholder'), 'old');
    await fireEvent.changeText(view.getByPlaceholderText('new_password_placeholder'), 'short');
    await fireEvent.changeText(
      view.getByPlaceholderText('confirm_new_password_placeholder'),
      'short',
    );
    await fireEvent.press(view.getByText('save'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'new_password_too_short');

    await fireEvent.changeText(view.getByPlaceholderText('new_password_placeholder'), 'newpass123');
    await fireEvent.changeText(
      view.getByPlaceholderText('confirm_new_password_placeholder'),
      'otherpass123',
    );
    await fireEvent.press(view.getByText('save'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'passwords_do_not_match');
    expect(mockChangeOwnPassword).not.toHaveBeenCalled();
  });

  it('changes the password and navigates back', async () => {
    const view = await render(<ChangePasswordScreen />);
    await view.findByText('save');
    await fireEvent.changeText(view.getByPlaceholderText('current_password_placeholder'), 'old');
    await fireEvent.changeText(view.getByPlaceholderText('new_password_placeholder'), 'newpass123');
    await fireEvent.changeText(
      view.getByPlaceholderText('confirm_new_password_placeholder'),
      'newpass123',
    );
    await fireEvent.press(view.getByText('save'));
    await waitFor(() =>
      expect(mockChangeOwnPassword).toHaveBeenCalledWith(server, 'old', 'newpass123'),
    );
    expect(mockAlert).toHaveBeenCalledWith('success', 'password_changed_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('maps save failures to specific messages', async () => {
    await withSilencedConsole(['error'], async () => {
      const view = await render(<ChangePasswordScreen />);
      await view.findByText('save');
      await fireEvent.changeText(view.getByPlaceholderText('current_password_placeholder'), 'old');
      await fireEvent.changeText(view.getByPlaceholderText('new_password_placeholder'), 'newpass123');
      await fireEvent.changeText(
        view.getByPlaceholderText('confirm_new_password_placeholder'),
        'newpass123',
      );

      mockChangeOwnPassword.mockRejectedValueOnce({ response: { status: 401 } });
      await fireEvent.press(view.getByText('save'));
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'incorrect_current_password'),
      );

      mockChangeOwnPassword.mockRejectedValueOnce({ isOffline: true });
      await fireEvent.press(view.getByText('save'));
      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'server_unreachable'));

      mockChangeOwnPassword.mockRejectedValueOnce(new Error('boom'));
      await fireEvent.press(view.getByText('save'));
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_change_password'),
      );
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });

  it('regenerates recovery codes after confirmation and shows them once', async () => {
    const view = await render(<ChangePasswordScreen />);
    await view.findByText('regenerate_recovery_codes_button');
    await fireEvent.changeText(view.getByPlaceholderText('current_password_placeholder'), 'old');
    await fireEvent.press(view.getByText('regenerate_recovery_codes_button'));
    expect(mockAlert).toHaveBeenCalledWith(
      'regenerate_recovery_codes_title',
      'regenerate_recovery_codes_confirm_message',
      expect.any(Array),
      { cancelable: true },
    );
    const confirm = alertButtons(0).find((b) => b.text === 'regenerate_recovery_codes_button');
    await act(async () => {
      await confirm?.onPress?.();
    });
    await view.findByText('recovery_codes_title');
    expect(view.getByText('rc-1')).toBeTruthy();
    expect(view.getByText('rc-2')).toBeTruthy();
    await fireEvent.press(view.getByText('recovery_codes_continue_button'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('maps regenerate failures to specific messages', async () => {
    await withSilencedConsole(['error'], async () => {
      mockRegenerateRecoveryCodes.mockRejectedValue({ response: { status: 401 } });
      const view = await render(<ChangePasswordScreen />);
      await view.findByText('regenerate_recovery_codes_button');
      await fireEvent.changeText(view.getByPlaceholderText('current_password_placeholder'), 'old');
      await fireEvent.press(view.getByText('regenerate_recovery_codes_button'));
      const confirm = alertButtons(0).find((b) => b.text === 'regenerate_recovery_codes_button');
      await act(async () => {
        await confirm?.onPress?.();
      });
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'incorrect_current_password'),
      );
      expect(view.queryByText('recovery_codes_title')).toBeNull();
    });
  });

  it('recovers with a code when the current password is forgotten', async () => {
    mockRedeem.mockResolvedValue({
      success: true,
      result: { accessToken: 'at', refreshToken: 'rt' },
    });
    const view = await render(<ChangePasswordScreen />);
    await view.findByText('forgot_current_password_link');
    await fireEvent.press(view.getByText('forgot_current_password_link'));
    await view.findByText('recovery_code_label');
    expect(view.queryByText('current_password')).toBeNull();

    await fireEvent.changeText(view.getByPlaceholderText('recovery_code_placeholder'), '   ');
    await fireEvent.changeText(view.getByPlaceholderText('new_password_placeholder'), 'newpass123');
    await fireEvent.changeText(
      view.getByPlaceholderText('confirm_new_password_placeholder'),
      'newpass123',
    );
    await fireEvent.press(view.getByText('reset_password_button'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'recovery_code_required');

    await fireEvent.changeText(view.getByPlaceholderText('recovery_code_placeholder'), 'RC-1');
    await fireEvent.press(view.getByText('reset_password_button'));
    await waitFor(() =>
      expect(mockRedeem).toHaveBeenCalledWith('https://s.example', 'alice', 'RC-1', 'newpass123'),
    );
    expect(mockUpdateTokens).toHaveBeenCalledWith('srv-1', 'at', 'rt');
    expect(mockAlert).toHaveBeenCalledWith('success', 'password_reset_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('reports recovery failures without leaving the screen', async () => {
    const view = await render(<ChangePasswordScreen />);
    await view.findByText('forgot_current_password_link');
    await fireEvent.press(view.getByText('forgot_current_password_link'));
    await view.findByText('recovery_code_label');
    await fireEvent.changeText(view.getByPlaceholderText('recovery_code_placeholder'), 'BAD');
    await fireEvent.changeText(view.getByPlaceholderText('new_password_placeholder'), 'newpass123');
    await fireEvent.changeText(
      view.getByPlaceholderText('confirm_new_password_placeholder'),
      'newpass123',
    );
    await fireEvent.press(view.getByText('reset_password_button'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'recovery_code_invalid'));
    expect(mockGoBack).not.toHaveBeenCalled();

    await fireEvent.press(view.getByText('back_to_change_password'));
    await view.findByText('current_password');
  });
});
