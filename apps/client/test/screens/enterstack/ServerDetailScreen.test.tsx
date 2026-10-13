const mockT = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = {
  goBack: (...args: unknown[]) => mockGoBack(...args),
  navigate: (...args: unknown[]) => mockNavigate(...args),
};
const mockRoute = { params: { serverId: 'srv-1' } };
const mockUseScreenHeader = jest.fn();
const mockDrizzle = {};
const mockGetAllServers = jest.fn();
const mockGetOwnedStories = jest.fn();
const mockUpdateServer = jest.fn();
const mockDeleteServer = jest.fn();
const mockUpdateOwnTag = jest.fn();
const mockGetOwnProfile = jest.fn();
const mockDeleteServerAccount = jest.fn();
const mockApiGet = jest.fn();
const mockAuthedGet = jest.fn();
const mockAuthedPost = jest.fn();
const mockPaymentOverview = jest.fn();
const mockAccountPlan = jest.fn();
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
  card: '#fafafa',
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

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name, size }: { name: string; size: number }) => (
      <Text testID={`icon-${name}-${size}`}>{`${name}-${size}`}</Text>
    ),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useIsFocused: () => true,
}));

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: jest.fn(), colors: mockColors }),
  };
});

jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({ useBackButtonHandler: () => {} }));
jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 20,
}));
jest.mock('../../../src/db', () => ({ useDrizzle: () => mockDrizzle }));
jest.mock('../../../src/hooks/usePaymentOverview', () => ({
  usePaymentOverview: (...args: unknown[]) => mockPaymentOverview(...args),
}));
jest.mock('../../../src/hooks/useAccountPlan', () => ({
  useAccountPlan: (...args: unknown[]) => mockAccountPlan(...args),
}));
const mockFetchAgeInfo = jest.fn();
const mockFetchVerificationStatus = jest.fn();
jest.mock('../../../src/services/AgeVerificationApiService', () => ({
  __esModule: true,
  fetchAgeVerificationInfo: (...args: unknown[]) => mockFetchAgeInfo(...args),
  fetchVerificationStatus: (...args: unknown[]) => mockFetchVerificationStatus(...args),
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
  return {
    ServerHasOwnedStoriesError,
    createServerService: () => ({
      getAllServers: (...args: unknown[]) => mockGetAllServers(...args),
      getOwnedStories: (...args: unknown[]) => mockGetOwnedStories(...args),
      updateServer: (...args: unknown[]) => mockUpdateServer(...args),
      deleteServer: (...args: unknown[]) => mockDeleteServer(...args),
    }),
  };
});

jest.mock('../../../src/services/DeleteAccountService', () => {
  class AccountDeletionCleanupError extends Error {}
  return {
    AccountDeletionCleanupError,
    deleteServerAccount: (...args: unknown[]) => mockDeleteServerAccount(...args),
  };
});

jest.mock('../../../src/services/apiClient', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockApiGet(...args) },
  apiUrl: (base: string, path: string) => `${base}${path}`,
  isOfflineError: (err: unknown) => !!(err as { isOffline?: boolean } | null)?.isOffline,
  createKeresAxiosInstance: () => ({
    get: (...args: unknown[]) => mockAuthedGet(...args),
    post: (...args: unknown[]) => mockAuthedPost(...args),
    setTokenProvider: jest.fn(),
    setActiveServer: jest.fn(),
  }),
}));

jest.mock('../../../src/services/UserApiService', () => ({
  userApiService: {
    updateOwnTag: (...args: unknown[]) => mockUpdateOwnTag(...args),
    getOwnProfile: (...args: unknown[]) => mockGetOwnProfile(...args),
  },
}));

jest.mock('../../../src/components/common/inputs/TextInput/TextInput', () => {
  const { TextInput } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <TextInput testID="tag-input" {...props} />,
  };
});

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import ServerDetailScreen from '../../../src/screens/enterstack/ServerDetailScreen';
import { AccountDeletionCleanupError } from '../../../src/services/DeleteAccountService';
import { useUserSettingsStore } from '../../../src/state/userSettingsStore';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const server = {
  id: 'srv-1',
  idUser: 'me-on-server',
  name: 'Main',
  url: 'https://a.example',
  userName: 'alice',
  tag: 'alice',
  lastSyncDate: new Date('2026-01-02T03:04:05.000Z'),
};

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

function alertButtons(callIndex = 0): AlertButton[] {
  return mockAlert.mock.calls[callIndex][2] as AlertButton[];
}

describe('ServerDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = { serverId: 'srv-1' };
    mockPaymentOverview.mockReturnValue({ overview: null, loading: false, reload: jest.fn() });
    mockAccountPlan.mockReturnValue({ plan: null, reload: jest.fn() });
    // A server that answers without saying anything about age, unless a test says so.
    mockFetchAgeInfo.mockResolvedValue(null);
    // An account that is through its age check, unless a test says otherwise.
    mockFetchVerificationStatus.mockResolvedValue({ status: 'not_required' });
    mockGetAllServers.mockResolvedValue([server, { ...server, id: 'srv-2', name: 'Other' }]);
    mockApiGet.mockResolvedValue({ status: 200, data: { version: '1.2.3' } });
    // A server predating the legal routes: no status, so no re-agreement is ever asked.
    mockAuthedGet.mockResolvedValue({ status: 404, data: null });
    mockAuthedPost.mockResolvedValue({ status: 200, data: null });
    mockGetOwnedStories.mockResolvedValue([]);
    mockDeleteServer.mockResolvedValue(undefined);
    mockUpdateServer.mockResolvedValue(undefined);
    mockUpdateOwnTag.mockResolvedValue({ tag: 'newtag' });
    mockGetOwnProfile.mockResolvedValue({ avatarColor: '#abcdef', avatarIcon: 'ion:star' });
    mockDeleteServerAccount.mockResolvedValue(undefined);
    useUserSettingsStore.setState({ userId: 'local-me' });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the server with where it is, who the user is, its tag, version and status', async () => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    expect(view.getByText('https://a.example')).toBeTruthy();
    expect(view.getByText('alice')).toBeTruthy();
    expect(view.getByText('@alice')).toBeTruthy();
    await view.findByText(/server_status_online/);
    await waitFor(() => expect(view.getByText('1.2.3')).toBeTruthy());
    expect(view.getByText('last_sync')).toBeTruthy();
    // It follows this server only.
    expect(view.queryByText('Other')).toBeNull();
    expect(mockApiGet).toHaveBeenCalledTimes(1);
    expect(mockUseScreenHeader.mock.calls.at(-1)![0].title).toBe('Main');
  });

  it('says so when the server never synchronised, and when it does not answer', async () => {
    mockGetAllServers.mockResolvedValue([{ ...server, lastSyncDate: null, tag: null }]);
    mockApiGet.mockRejectedValue(new Error('down'));

    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    expect(view.getByText('server_never_synced')).toBeTruthy();
    expect(view.getByText('no_tag_set')).toBeTruthy();
    await view.findByText('server_status_offline');
    expect(view.queryByText('server_api_version_field')).toBeNull();
    // Offline, the user's own avatar is not asked for.
    expect(mockGetOwnProfile).not.toHaveBeenCalled();
  });

  it("reads the user's own avatar once the server answers, and lives without it", async () => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');
    await waitFor(() => expect(mockGetOwnProfile).toHaveBeenCalledTimes(1));
    expect(mockGetOwnProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 'srv-1' }));
  });

  it('lives without the avatar when it cannot be read', async () => {
    mockGetOwnProfile.mockRejectedValue(new Error('no profile'));

    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');
    await waitFor(() => expect(mockGetOwnProfile).toHaveBeenCalled());

    expect(view.getByText('Main')).toBeTruthy();
  });

  it('opens profile, password and connection from their own rows', async () => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    await fireEvent.press(view.getByTestId('server-action-profile'));
    expect(mockNavigate).toHaveBeenCalledWith('MyProfile', { serverId: 'srv-1' });
    await fireEvent.press(view.getByTestId('server-action-password'));
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword', { serverId: 'srv-1' });
    await fireEvent.press(view.getByTestId('server-action-connection'));
    expect(mockNavigate).toHaveBeenCalledWith('ServerRegistration', { serverId: 'srv-1' });
  });

  it('reads the agreed server terms from the local copy, offline', async () => {
    mockGetAllServers.mockResolvedValue([
      {
        ...server,
        tosText: 'Rules\nBe kind.',
        tosVersion: '3',
        tosAcceptedAt: new Date('2026-10-01T10:00:00.000Z'),
      },
    ]);
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    await fireEvent.press(view.getByTestId('server-action-terms'));
    await view.findByTestId('server-terms-modal-scroll');
    expect(mockApiGet).toHaveBeenCalledTimes(1);
  });

  it('hides the terms row when no copy was ever agreed to', async () => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    expect(view.queryByTestId('server-action-terms')).toBeNull();
  });

  it('reads the agreed privacy copy from the local row, offline', async () => {
    mockGetAllServers.mockResolvedValue([
      {
        ...server,
        privacyText: 'Privacy\nWe keep little.',
        privacyVersion: '1',
        privacyAcceptedAt: new Date('2026-10-01T10:00:00.000Z'),
      },
    ]);
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    await fireEvent.press(view.getByTestId('server-action-privacy'));
    await view.findByTestId('server-privacy-modal-scroll');
    expect(mockApiGet).toHaveBeenCalledTimes(1);
  });

  it("titles the privacy copy's header as privacy, not as terms, with its own version", async () => {
    mockGetAllServers.mockResolvedValue([
      {
        ...server,
        privacyText: 'Privacy\nWe keep little.',
        privacyVersion: '1',
        privacyAcceptedAt: new Date('2026-10-01T10:00:00.000Z'),
      },
    ]);
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    await fireEvent.press(view.getByTestId('server-action-privacy'));
    await view.findByTestId('server-privacy-modal-scroll');

    expect(view.getByText(/^server_privacy_version:\{"version":"1"/)).toBeTruthy();
    expect(view.queryByText(/^server_terms_version:/)).toBeNull();
  });

  it('hides the privacy row when no copy was ever agreed to', async () => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    expect(view.queryByTestId('server-action-privacy')).toBeNull();
    expect(view.queryByTestId('server-action-legal-update')).toBeNull();
  });

  describe('legal updates', () => {
    // What the account agreed to, as the server reports it: accepting moves it forward,
    // the way the real route would.
    let acceptedTos = 1;
    const freshSections = [{ heading: 'Rules', paragraphs: ['New rules.'] }];

    beforeEach(() => {
      acceptedTos = 1;
      mockAuthedGet.mockImplementation(async () => ({
        status: 200,
        data: {
          tos: { accepted: acceptedTos, current: 2 },
          privacy: { accepted: 1, current: 1 },
        },
      }));
      mockAuthedPost.mockImplementation(async (_url: unknown, body: unknown) => {
        if ((body as { kind?: string }).kind === 'tos') acceptedTos = 2;
        return {
          status: 200,
          data: {
            tos: { accepted: acceptedTos, current: 2 },
            privacy: { accepted: 1, current: 1 },
          },
        };
      });
      mockApiGet.mockImplementation(async (url: unknown) =>
        String(url).endsWith('/keres-tos')
          ? {
              status: 200,
              data: { version: 2, updatedAt: '2026-10-11', en: freshSections },
            }
          : { status: 200, data: { version: '1.2.3' } },
      );
      mockGetAllServers.mockResolvedValue([
        {
          ...server,
          tosText: 'Rules\nOld.',
          tosVersion: '1',
          tosAcceptedAt: new Date('2026-10-01T10:00:00.000Z'),
        },
      ]);
    });

    it('asks to agree when the server terms moved on, and saves the new copy', async () => {
      const view = await render(<ServerDetailScreen />);
      await view.findByTestId('server-action-legal-update');

      await fireEvent.press(view.getByTestId('server-action-legal-update'));
      await view.findByTestId('server-legal-update-modal-scroll');
      // Agreement is gated on reading to the end, as at registration.
      await fireEvent.press(view.getByTestId('server-legal-update-modal-accept'));
      expect(mockAuthedPost).not.toHaveBeenCalled();

      await fireEvent(view.getByTestId('server-legal-update-modal-scroll'), 'onScroll', {
        nativeEvent: {
          contentSize: { height: 1000 },
          layoutMeasurement: { height: 200 },
          contentOffset: { y: 800 },
        },
      });
      await fireEvent.press(view.getByTestId('server-legal-update-modal-accept'));

      await waitFor(() =>
        expect(mockAuthedPost).toHaveBeenCalledWith(
          '/auth/terms-accept',
          { kind: 'tos' },
          expect.anything(),
        ),
      );
      expect(mockUpdateServer).toHaveBeenCalledWith(
        'srv-1',
        expect.objectContaining({
          tosText: 'Rules\nNew rules.',
          tosVersion: '2',
          tosAcceptedAt: expect.any(Date),
        }),
      );
      await waitFor(() => expect(view.queryByTestId('server-action-legal-update')).toBeNull());
    });

    it('says so when agreement cannot be recorded', async () => {
      mockAuthedPost.mockResolvedValue({ status: 500, data: null });
      const view = await render(<ServerDetailScreen />);
      await view.findByTestId('server-action-legal-update');

      await fireEvent.press(view.getByTestId('server-action-legal-update'));
      await view.findByTestId('server-legal-update-modal-scroll');
      await fireEvent(view.getByTestId('server-legal-update-modal-scroll'), 'onScroll', {
        nativeEvent: {
          contentSize: { height: 1000 },
          layoutMeasurement: { height: 200 },
          contentOffset: { y: 800 },
        },
      });
      await fireEvent.press(view.getByTestId('server-legal-update-modal-accept'));

      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'server_legal_accept_failed'),
      );
      expect(mockUpdateServer).not.toHaveBeenCalled();
      expect(view.getByTestId('server-action-legal-update')).toBeTruthy();
    });
  });

  // Deleting the account and removing the server from this device is one operation (its service
  // has the tests); the screen's part is the alert it shows and where it takes the person.
  const confirmDeleteAccount = async (password: string) => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');
    await fireEvent.press(view.getByTestId('server-action-delete-account'));
    await fireEvent.changeText(view.getByTestId('delete-account-modal-password'), password);
    await fireEvent.press(view.getByTestId('delete-account-modal-confirm'));
    return view;
  };

  it('deletes the account and the server with it, then goes back with the success alert', async () => {
    await confirmDeleteAccount('password123');

    await waitFor(() => expect(mockDeleteServerAccount).toHaveBeenCalledTimes(1));
    expect(mockDeleteServerAccount).toHaveBeenCalledWith(
      mockDrizzle,
      expect.objectContaining({ id: 'srv-1' }),
      'password123',
      'local-me',
    );
    expect(mockAlert).toHaveBeenCalledWith('success', 'delete_account_done');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('says why deleting the account failed, and stays with the server', async () => {
    mockDeleteServerAccount.mockRejectedValue({ response: { status: 401 } });
    const view = await confirmDeleteAccount('wrong');

    await view.findByText('incorrect_current_password');
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('says the server is unreachable when the device is offline, and stays', async () => {
    mockDeleteServerAccount.mockRejectedValue({ isOffline: true });
    const view = await confirmDeleteAccount('password123');

    await view.findByText('server_unreachable');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('says the account is gone but the removal is unfinished, and stays on this screen to finish it', async () => {
    mockDeleteServerAccount.mockRejectedValue(
      new AccountDeletionCleanupError(new Error('socket hang up')),
    );
    await confirmDeleteAccount('password123');

    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith('error', 'delete_account_cleanup_failed'),
    );
    expect(mockAlert).not.toHaveBeenCalledWith('success', expect.anything());
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("opens the conversation with this server's administrators, in the same stack so back returns here", async () => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    await fireEvent.press(view.getByTestId('server-action-messages'));

    expect(mockNavigate).toHaveBeenCalledWith('Conversation', { serverId: 'srv-1', peer: 'admin' });
  });

  describe('plan and payment', () => {
    /** Ahead of the real clock: whether a plan is shown as paid up depends on the date. */
    const PAID_UNTIL = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    const subscription = {
      tierId: 't1',
      tierName: 'Pro',
      interval: 'monthly',
      status: 'active',
      paidUntil: PAID_UNTIL,
      lastPaymentAt: null,
      amountCents: 1990,
      currency: 'BRL',
      cancelAtPeriodEnd: false,
      canCancelHere: true,
      autoRenews: true,
      complimentary: false,
    };
    const overview = (sub: unknown) => ({
      overview: { info: { enabled: true, subscription: sub }, plans: null },
      loading: false,
      reload: jest.fn(),
    });

    it('shows nothing about payments on a server that sells no plans, or while it is offline', async () => {
      const view = await render(<ServerDetailScreen />);
      await view.findByText('Main');

      expect(view.queryByTestId('plan-status-card')).toBeNull();
      expect(view.queryByTestId('server-action-plan')).toBeNull();
      expect(view.queryByText('server_plan_section')).toBeNull();
    });

    it('does not ask the payment hook while the server is offline', async () => {
      mockApiGet.mockRejectedValue(new Error('down'));
      const view = await render(<ServerDetailScreen />);
      await view.findByText('server_status_offline');

      expect(mockPaymentOverview.mock.calls.at(-1)![1]).toBe(false);
    });

    it('asks the payment hook once the server answers', async () => {
      const view = await render(<ServerDetailScreen />);
      await view.findByText(/server_status_online/);

      await waitFor(() => expect(mockPaymentOverview.mock.calls.at(-1)![1]).toBe(true));
    });

    it("badges the way to the messages when this server's administrators wrote", async () => {
      const { useUnseenMessagesStore } = require('../../../src/state/unseenMessagesStore');
      await act(async () => {
        useUnseenMessagesStore.setState({ unseen: { 'srv-1|admin': '09' } });
      });
      const view = await render(<ServerDetailScreen />);
      await view.findByText('Main');

      expect(view.getByTestId('server-action-badge')).toBeTruthy();
      expect(view.getByLabelText(/server_action_messages\. messages_unseen_admin_on/)).toBeTruthy();

      await act(async () => {
        useUnseenMessagesStore.setState({ unseen: { 'srv-2|admin': '09', 'srv-1|u1': '09' } });
      });
      expect(view.queryByTestId('server-action-badge')).toBeNull();
      await act(async () => {
        useUnseenMessagesStore.setState({ unseen: {} });
      });
    });

    it('shows the plan with its dates, and the way to the plans, for a user with a paid plan', async () => {
      mockPaymentOverview.mockReturnValue(overview(subscription));
      const view = await render(<ServerDetailScreen />);
      await view.findByText('Main');

      expect(view.getByText('server_plan_section')).toBeTruthy();
      expect(view.getByTestId('plan-status-card')).toBeTruthy();
      expect(view.getByText('payment_status_active')).toBeTruthy();
      expect(view.getByTestId('server-action-plan')).toBeTruthy();
    });

    it('offers the plans, with no card of dates, to a user on a free plan', async () => {
      mockPaymentOverview.mockReturnValue(overview(null));
      const view = await render(<ServerDetailScreen />);
      await view.findByText('Main');

      expect(view.queryByTestId('plan-status-card')).toBeNull();
      expect(view.queryByText('server_plan_section')).toBeNull();
      expect(view.getByTestId('server-action-plan')).toBeTruthy();
    });

    it('says what the plan comes with, the free one included, with no need to open a story', async () => {
      mockAccountPlan.mockReturnValue({
        plan: {
          tierName: 'Free',
          isDefault: true,
          maxStories: 3,
          maxEntitiesPerStory: 200,
          maxEntitiesTotal: 500,
          maxPublicationsPerDay: null,
          maxPublishedArcs: 1,
          storiesUsed: 1,
          entitiesUsedTotal: 120,
        },
        reload: jest.fn(),
      });
      const view = await render(<ServerDetailScreen />);
      await view.findByText('Main');

      expect(view.getByText('server_plan_section')).toBeTruthy();
      expect(view.getByTestId('plan-limits-card')).toBeTruthy();
      expect(view.getByText('Free')).toBeTruthy();
      expect(view.getByText('plan_card_default_hint')).toBeTruthy();
      expect(view.getByText('plan_limit_stories_other:{"count":3}')).toBeTruthy();
      expect(view.getByText('plan_card_stories_used:{"used":1,"limit":3}')).toBeTruthy();
      expect(view.getByText('plan_card_entities_used:{"used":120,"limit":500}')).toBeTruthy();
      // No subscription behind it: no card of dates.
      expect(view.queryByTestId('plan-status-card')).toBeNull();
    });

    it('puts what a paid plan comes with above where it stands', async () => {
      mockPaymentOverview.mockReturnValue(overview(subscription));
      mockAccountPlan.mockReturnValue({
        plan: {
          tierName: 'Pro',
          isDefault: false,
          maxStories: null,
          maxEntitiesPerStory: null,
          maxEntitiesTotal: null,
          maxPublicationsPerDay: null,
          maxPublishedArcs: null,
          storiesUsed: 4,
          entitiesUsedTotal: 0,
        },
        reload: jest.fn(),
      });
      const view = await render(<ServerDetailScreen />);
      await view.findByText('Main');

      expect(view.getByTestId('plan-limits-card')).toBeTruthy();
      expect(view.getByTestId('plan-status-card')).toBeTruthy();
      expect(view.getByText('plan_limit_stories_unlimited')).toBeTruthy();
      expect(view.queryByText(/plan_card_stories_used/)).toBeNull();
    });

    it('opens the payment history of this server, next to the plans', async () => {
      mockPaymentOverview.mockReturnValue(overview(subscription));
      const view = await render(<ServerDetailScreen />);
      await view.findByText('Main');

      await fireEvent.press(view.getByTestId('server-action-payment-history'));

      expect(mockNavigate).toHaveBeenCalledWith('ServerPaymentHistory', { serverId: 'srv-1' });
    });

    it('opens the plans of this server in the same stack', async () => {
      mockPaymentOverview.mockReturnValue(overview(subscription));
      const view = await render(<ServerDetailScreen />);
      await view.findByText('Main');

      await fireEvent.press(view.getByTestId('server-action-plan'));

      expect(mockNavigate).toHaveBeenCalledWith('ServerPlan', { serverId: 'srv-1' });
    });
  });

  it('sends the tag in the shape it is stored: lowercase, spaces made underscores', async () => {
    mockUpdateOwnTag.mockResolvedValue({ tag: 'ana_maria' });
    const view = await render(<ServerDetailScreen />);
    await view.findByText('@alice');
    await fireEvent.press(view.getByText('@alice'));
    await fireEvent.changeText(view.getByTestId('tag-input'), '  @Ana Maria ');
    await fireEvent.press(view.getByLabelText('save'));

    await waitFor(() =>
      expect(mockUpdateOwnTag).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'srv-1' }),
        'ana_maria',
      ),
    );
    expect(mockUpdateServer).toHaveBeenCalledWith('srv-1', { tag: 'ana_maria' });
    await view.findByText('@ana_maria');
  });

  it('does not ask the server about a tag that cannot be one', async () => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('@alice');
    await fireEvent.press(view.getByText('@alice'));
    await fireEvent.changeText(view.getByTestId('tag-input'), 'a!');
    await fireEvent.press(view.getByLabelText('save'));

    expect(mockUpdateOwnTag).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('error', 'invalid_friend_id_format');
  });

  it('starts from the current tag, cancels, and ignores an unchanged one', async () => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('@alice');
    await fireEvent.press(view.getByText('@alice'));
    expect(view.getByTestId('tag-input').props.value).toBe('alice');
    await fireEvent.press(view.getByLabelText('save'));
    expect(mockUpdateOwnTag).not.toHaveBeenCalled();
    await view.findByText('@alice');

    await fireEvent.press(view.getByText('@alice'));
    await fireEvent.press(view.getByLabelText('cancel'));
    await view.findByText('@alice');
    expect(mockUpdateOwnTag).not.toHaveBeenCalled();
  });

  it('maps tag save failures to specific messages', async () => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('@alice');

    for (const [error, message] of [
      [{ isOffline: true }, 'server_unreachable'],
      [{ response: { status: 409 } }, 'tag_already_taken'],
      [{ response: { status: 400 } }, 'invalid_tag_format'],
      [new Error('boom'), 'failed_to_update_tag'],
    ] as const) {
      mockUpdateOwnTag.mockRejectedValueOnce(error);
      await fireEvent.press(view.getByText('@alice'));
      await fireEvent.changeText(view.getByTestId('tag-input'), 'taken');
      await fireEvent.press(view.getByLabelText('save'));
      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', message));
      await fireEvent.press(view.getByLabelText('cancel'));
      await view.findByText('@alice');
    }
  });

  it('removes the server after confirmation, and leaves the screen', async () => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    await fireEvent.press(view.getByTestId('server-action-delete'));
    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith(
        'delete_server_title',
        'delete_server_message',
        expect.any(Array),
        { cancelable: true },
      ),
    );
    const del = alertButtons(0).find((b) => b.text === 'delete');
    await act(async () => {
      await del?.onPress?.();
    });

    await waitFor(() => expect(mockDeleteServer).toHaveBeenCalledWith('srv-1'));
    expect(mockAlert).toHaveBeenCalledWith('success', 'server_deleted_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('blocks removal while the server owns stories', async () => {
    mockGetOwnedStories.mockResolvedValue([{ title: 'Epic' }]);
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    await fireEvent.press(view.getByTestId('server-action-delete'));

    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith(
        'cannot_delete_server_owned_stories_title',
        expect.stringContaining('cannot_delete_server_owned_stories_message'),
      ),
    );
    expect(mockDeleteServer).not.toHaveBeenCalled();
  });

  it('reports removal failures', async () => {
    await withSilencedConsole(['error'], async () => {
      const view = await render(<ServerDetailScreen />);
      await view.findByText('Main');

      mockGetOwnedStories.mockRejectedValueOnce(new Error('db down'));
      await fireEvent.press(view.getByTestId('server-action-delete'));
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_delete_server'),
      );

      const { ServerHasOwnedStoriesError } = jest.requireMock(
        '../../../src/services/ServerService',
      ) as { ServerHasOwnedStoriesError: new (s: Array<{ title: string }>) => Error };
      mockDeleteServer.mockRejectedValueOnce(new ServerHasOwnedStoriesError([{ title: 'Epic' }]));
      await fireEvent.press(view.getByTestId('server-action-delete'));
      await waitFor(() => expect(mockAlert.mock.calls.at(-1)![0]).toBe('delete_server_title'));
      const owned = alertButtons(mockAlert.mock.calls.length - 1).find((b) => b.text === 'delete');
      await act(async () => {
        await owned?.onPress?.();
      });
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith(
          'cannot_delete_server_owned_stories_title',
          expect.stringContaining('Epic'),
        ),
      );

      mockDeleteServer.mockRejectedValueOnce(new Error('boom'));
      await fireEvent.press(view.getByTestId('server-action-delete'));
      await waitFor(() => expect(mockAlert.mock.calls.at(-1)![0]).toBe('delete_server_title'));
      const del = alertButtons(mockAlert.mock.calls.length - 1).find((b) => b.text === 'delete');
      await act(async () => {
        await del?.onPress?.();
      });
      await waitFor(() =>
        expect(mockAlert).toHaveBeenLastCalledWith('error', 'failed_to_delete_server'),
      );
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });

  it('says the server is gone when it is not registered any more, and goes back from it', async () => {
    mockRoute.params = { serverId: 'missing' };

    const view = await render(<ServerDetailScreen />);
    await view.findByText('server_not_found');

    expect(mockUseScreenHeader.mock.calls.at(-1)![0].title).toBe('server_detail_title');
  });

  it('shows the failure when the servers cannot be read', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetAllServers.mockRejectedValue(new Error('db down'));

      const view = await render(<ServerDetailScreen />);

      await view.findByText('failed_to_load_servers');
    });
  });

  describe('age verification line', () => {
    it('says a server that requires verification requires it for new accounts', async () => {
      mockFetchAgeInfo.mockResolvedValue({ mode: 'required', available: true });
      const view = await render(<ServerDetailScreen />);

      expect(await view.findByText('age_verification_line_required')).toBeTruthy();
      expect(view.queryByText('age_verification_line_disabled')).toBeNull();
    });

    it('says a server without verification has none, so it never looks verified', async () => {
      mockFetchAgeInfo.mockResolvedValue({ mode: 'disabled', available: false });
      const view = await render(<ServerDetailScreen />);

      expect(await view.findByText('age_verification_line_disabled')).toBeTruthy();
      expect(view.queryByText('age_verification_line_required')).toBeNull();
    });

    it('says nothing about age when the server does not say', async () => {
      const view = await render(<ServerDetailScreen />);
      await view.findByText('Main');
      await waitFor(() => expect(mockFetchAgeInfo).toHaveBeenCalledWith('https://a.example'));

      expect(view.queryByTestId('server-age-verification')).toBeNull();
    });

    it('does not ask an offline server about its age', async () => {
      mockApiGet.mockRejectedValue(new Error('down'));
      const view = await render(<ServerDetailScreen />);
      await view.findByText('server_status_offline');

      expect(mockFetchAgeInfo).not.toHaveBeenCalled();
      expect(view.queryByTestId('server-age-verification')).toBeNull();
    });
  });
  describe('finishing the age verification', () => {
    const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    it.each(['pending', 'rejected', 'expired'])(
      'offers a way to finish the age check when the account is %s, and opens it',
      async (status) => {
        mockFetchVerificationStatus.mockResolvedValue({ status });
        const view = await render(<ServerDetailScreen />);

        const card = await view.findByTestId('server-action-verification');
        await fireEvent.press(card);

        expect(mockNavigate).toHaveBeenCalledWith('ServerVerification', { serverId: 'srv-1' });
      },
    );

    it.each(['approved', 'not_required'])(
      'offers nothing when the account is %s',
      async (status) => {
        mockFetchVerificationStatus.mockResolvedValue({ status });
        const view = await render(<ServerDetailScreen />);
        await waitFor(() => expect(mockFetchVerificationStatus).toHaveBeenCalled());
        await settle();

        expect(view.queryByTestId('server-action-verification')).toBeNull();
      },
    );

    it('does not ask an offline server, and offers nothing', async () => {
      mockApiGet.mockRejectedValue(new Error('down'));
      const view = await render(<ServerDetailScreen />);
      await view.findByText('server_status_offline');
      await settle();

      expect(mockFetchVerificationStatus).not.toHaveBeenCalled();
      expect(view.queryByTestId('server-action-verification')).toBeNull();
    });

    it('offers nothing when the server cannot say (an older server has no such route)', async () => {
      mockFetchVerificationStatus.mockRejectedValue(new Error('not found'));
      const view = await render(<ServerDetailScreen />);
      await waitFor(() => expect(mockFetchVerificationStatus).toHaveBeenCalled());
      await settle();

      expect(view.queryByTestId('server-action-verification')).toBeNull();
    });
  });
});
