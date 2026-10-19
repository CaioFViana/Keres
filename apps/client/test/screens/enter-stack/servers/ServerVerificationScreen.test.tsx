import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';
import {
  AgeVerificationConflictError,
  AgeVerificationUnavailableError,
} from '@/src/services/api/AgeVerificationApiService';
import ServerVerificationScreen from '@/src/screens/enter-stack/servers/ServerVerificationScreen';

const mockT = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = {
  goBack: (...args: unknown[]) => mockGoBack(...args),
  navigate: (...args: unknown[]) => mockNavigate(...args),
};
const mockRoute = { params: { serverId: 'srv-1' } };
const mockStatuses = jest.fn();
const mockFetchStatus = jest.fn();
const mockRetry = jest.fn();
const mockGetTokens = jest.fn();
const mockRefreshAccessToken = jest.fn();
const mockUpdateTokens = jest.fn();
const mockSetActiveServer = jest.fn();
const mockRemove = jest.fn();
let appListener: ((state: string) => void) | undefined;
const mockColors = {
  primary: '#0000ff',
  onPrimary: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  background: '#ffffff',
  card: '#fafafa',
  border: '#cccccc',
  error: '#ff0000',
  surface: '#f5f5f5',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT, i18n: { language: 'en' } }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useIsFocused: () => true,
}));

jest.mock('@/src/theme', () => {
  const actual = jest.requireActual('@/src/theme');
  return { ...actual, useTheme: () => ({ isDarkMode: false, colors: mockColors }) };
});

jest.mock('@/src/hooks/nav/useScreenHeader', () => ({ useScreenHeader: jest.fn() }));
jest.mock('@/src/hooks/nav/useBackButtonHandler', () => ({ useBackButtonHandler: () => {} }));
jest.mock('@/src/hooks/forms/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 20,
}));

jest.mock('@/src/screens/enter-stack/servers/useServerStatuses', () => ({
  useServerStatuses: (...args: unknown[]) => mockStatuses(...args),
}));

// The service's error classes are real, so the screen's own checks on them are the ones tested.
jest.mock('@/src/services/api/AgeVerificationApiService', () => {
  class AgeVerificationConflictError extends Error {}
  class AgeVerificationUnavailableError extends Error {}
  return {
    __esModule: true,
    AgeVerificationConflictError,
    AgeVerificationUnavailableError,
    fetchVerificationStatus: (...args: unknown[]) => mockFetchStatus(...args),
    retryVerification: (...args: unknown[]) => mockRetry(...args),
  };
});

jest.mock('@/src/services/auth/AuthTokenManager', () => ({
  authTokenManager: {
    getTokens: (...args: unknown[]) => mockGetTokens(...args),
    refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
    updateTokens: (...args: unknown[]) => mockUpdateTokens(...args),
  },
}));

jest.mock('@/src/state/app/userSettingsStore', () => ({
  useUserSettingsStore: {
    getState: () => ({ setActiveServer: (...args: unknown[]) => mockSetActiveServer(...args) }),
  },
}));

const server = { id: 'srv-1', url: 'https://s.example', name: 'Main' };
const pending = {
  status: 'pending',
  action: { kind: 'redirect', url: 'https://verify.example/v/token' },
};

let fakeClock = false;
function useFakeClock() {
  fakeClock = true;
  jest.useFakeTimers();
}

async function renderScreen() {
  return render(<ServerVerificationScreen />);
}

describe('ServerVerificationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatuses.mockReturnValue({ servers: [server], loading: false, error: null });
    mockFetchStatus.mockResolvedValue(pending);
    mockRetry.mockResolvedValue(pending);
    mockGetTokens.mockResolvedValue({ accessToken: 'old-at', refreshToken: 'old-rt' });
    mockRefreshAccessToken.mockResolvedValue(null);
    mockUpdateTokens.mockResolvedValue(undefined);
    (AppState.addEventListener as jest.Mock).mockImplementation(
      (_type: string, listener: (state: string) => void) => {
        appListener = listener;
        return { remove: mockRemove };
      },
    );
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    // React schedules its own work on the timers: a task left on a fake clock would stall every later render.
    if (fakeClock) jest.runOnlyPendingTimers();
    fakeClock = false;
    jest.useRealTimers();
  });

  describe('while pending', () => {
    it('says what is sent and who reads it, and opens the verification page of the server', async () => {
      const view = await renderScreen();

      expect(await view.findByText('verification_open_page')).toBeTruthy();
      expect(view.getByText('verification_explain_send')).toBeTruthy();
      expect(view.getByText('verification_explain_reader')).toBeTruthy();
      expect(view.getByText('verification_explain_destroyed')).toBeTruthy();
      await fireEvent.press(view.getByText('verification_open_page'));

      expect(Linking.openURL).toHaveBeenCalledWith('https://verify.example/v/token');
      // The screen stays until the account is approved.
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it.each(['http://verify.example/v/token', 'javascript:alert(1)', 'data:text/html,<p>hi</p>'])(
      'does not open an address that is not https: %s',
      async (url) => {
        mockFetchStatus.mockResolvedValue({ status: 'pending', action: { kind: 'redirect', url } });
        const view = await renderScreen();

        expect(await view.findByTestId('verification-link-refused')).toBeTruthy();
        expect(view.queryByText('verification_open_page')).toBeNull();
        expect(Linking.openURL).not.toHaveBeenCalled();
      },
    );

    it('shows the instructions of a server that asks for something else', async () => {
      mockFetchStatus.mockResolvedValue({
        status: 'pending',
        action: { kind: 'instructions', title: 'Send by post', text: 'Post a copy to the office.' },
      });
      const view = await renderScreen();

      expect(await view.findByText('Send by post')).toBeTruthy();
      expect(view.getByText('Post a copy to the office.')).toBeTruthy();
      expect(view.queryByText('verification_open_page')).toBeNull();
    });
  });

  describe('approval', () => {
    it('stores the session the moment the account is approved, once, and leaves', async () => {
      useFakeClock();
      const session = { accessToken: 'at-2', refreshToken: 'rt-2' };
      mockFetchStatus
        .mockResolvedValueOnce(pending)
        .mockResolvedValue({ status: 'approved', session });
      const view = await renderScreen();
      await view.findByText('verification_open_page');

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(mockUpdateTokens).toHaveBeenCalledWith('srv-1', 'at-2', 'rt-2');
      expect(mockSetActiveServer).toHaveBeenCalledWith(server);
      await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));

      // The session came once: asking again, while the screen is still mounted, stores nothing more.
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(mockUpdateTokens).toHaveBeenCalledTimes(1);
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    it('asks for a fresh session when the approval came without one', async () => {
      mockFetchStatus.mockResolvedValue({ status: 'approved' });
      mockRefreshAccessToken.mockResolvedValue({ accessToken: 'at-3', refreshToken: 'rt-3' });
      const view = await renderScreen();

      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
      expect(mockRefreshAccessToken).toHaveBeenCalledWith('srv-1', 'old-rt');
      expect(mockUpdateTokens).toHaveBeenCalledWith('srv-1', 'at-3', 'rt-3');
      expect(view.queryByText('verification_open_page')).toBeNull();
    });
  });

  describe('refused or expired', () => {
    it('shows the reason, and sends the documents again when a retry is allowed', async () => {
      mockFetchStatus.mockResolvedValue({
        status: 'rejected',
        reason: 'document_unreadable',
        canRetry: true,
      });
      const view = await renderScreen();

      expect(await view.findByText('verification_reason_document_unreadable')).toBeTruthy();
      await fireEvent.press(view.getByTestId('verification-retry'));

      // The retry carries the app's language: the upload page of the new sending is written in it.
      expect(mockRetry).toHaveBeenCalledWith(expect.objectContaining({ id: 'srv-1' }), 'en');
      expect(await view.findByText('verification_open_page')).toBeTruthy();
    });

    it('says plainly that an underage account was closed, with no way to send again', async () => {
      mockFetchStatus.mockResolvedValue({
        status: 'rejected',
        reason: 'underage',
        canRetry: false,
      });
      const view = await renderScreen();

      expect(await view.findByText('verification_closed_underage')).toBeTruthy();
      expect(view.getByText('verification_reason_underage')).toBeTruthy();
      expect(view.queryByTestId('verification-retry')).toBeNull();
    });

    it('says an expired sending cannot be completed here, and offers the servers again', async () => {
      mockFetchStatus.mockResolvedValue({ status: 'expired', canRetry: false });
      const view = await renderScreen();

      expect(await view.findByText('verification_reason_expired')).toBeTruthy();
      expect(view.getByText('verification_closed')).toBeTruthy();
      expect(view.queryByTestId('verification-retry')).toBeNull();
      await fireEvent.press(view.getByTestId('verification-back'));
      expect(mockNavigate).toHaveBeenCalledWith('ServerManagement');
    });

    it('says a retry the server does not allow right now is not allowed', async () => {
      mockFetchStatus.mockResolvedValue({ status: 'rejected', reason: 'other', canRetry: true });
      mockRetry.mockRejectedValue(new AgeVerificationConflictError());
      const view = await renderScreen();

      await fireEvent.press(await view.findByTestId('verification-retry'));
      expect(await view.findByTestId('verification-retry-error')).toHaveProp(
        'children',
        'verification_retry_conflict',
      );
    });

    it('says the verification service is down when a retry cannot be made', async () => {
      mockFetchStatus.mockResolvedValue({ status: 'rejected', reason: 'other', canRetry: true });
      mockRetry.mockRejectedValue(new AgeVerificationUnavailableError());
      const view = await renderScreen();

      await fireEvent.press(await view.findByTestId('verification-retry'));
      expect(await view.findByTestId('verification-retry-error')).toHaveProp(
        'children',
        'verification_service_unavailable',
      );
    });
  });

  // The test that moves a fake clock is the last one here on purpose: React's scheduler keeps a task on that clock
  // afterwards, and every render after it would stall. It is also why the screen's cleanup is checked with real timers.
  describe('polling', () => {
    it('stops asking when the screen is left', async () => {
      const view = await renderScreen();
      await waitFor(() => expect(mockFetchStatus).toHaveBeenCalledTimes(1));

      view.unmount();
      // The cleanup of the screen stops the polling and drops the app listener together; React runs it as a task of its own.
      await waitFor(() => expect(mockRemove).toHaveBeenCalled());
    });

    it('keeps asking after a look that did not get through', async () => {
      mockFetchStatus.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(pending);
      const view = await renderScreen();

      expect(await view.findByTestId('verification-load-failed')).toBeTruthy();
      // Back to the front asks at once: the next look gets through and the screen follows it.
      await act(async () => {
        appListener?.('active');
      });
      expect(await view.findByText('verification_open_page')).toBeTruthy();
    });

    it('asks every five seconds while in front, and at once on the way back to the front', async () => {
      useFakeClock();
      await renderScreen();
      await act(async () => {});
      expect(mockFetchStatus).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(mockFetchStatus).toHaveBeenCalledTimes(2);

      act(() => appListener?.('background'));
      await act(async () => {
        jest.advanceTimersByTime(15000);
      });
      expect(mockFetchStatus).toHaveBeenCalledTimes(2);

      await act(async () => {
        appListener?.('active');
      });
      expect(mockFetchStatus).toHaveBeenCalledTimes(3);
      await act(async () => {
        jest.advanceTimersByTime(5000);
      });
      expect(mockFetchStatus).toHaveBeenCalledTimes(4);
    });
  });
});
