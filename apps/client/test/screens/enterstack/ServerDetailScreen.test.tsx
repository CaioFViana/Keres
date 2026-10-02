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
const mockApiGet = jest.fn();
const mockPaymentOverview = jest.fn();
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

jest.mock('../../../src/services/apiClient', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockApiGet(...args) },
  apiUrl: (base: string, path: string) => `${base}${path}`,
  isOfflineError: (err: unknown) => !!(err as { isOffline?: boolean } | null)?.isOffline,
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
    mockGetAllServers.mockResolvedValue([server, { ...server, id: 'srv-2', name: 'Other' }]);
    mockApiGet.mockResolvedValue({ status: 200, data: { version: '1.2.3' } });
    mockGetOwnedStories.mockResolvedValue([]);
    mockDeleteServer.mockResolvedValue(undefined);
    mockUpdateServer.mockResolvedValue(undefined);
    mockUpdateOwnTag.mockResolvedValue({ tag: 'newtag' });
    mockGetOwnProfile.mockResolvedValue({ avatarColor: '#abcdef', avatarIcon: 'ion:star' });
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

  it("opens the conversation with this server's administrators, in the same stack so back returns here", async () => {
    const view = await render(<ServerDetailScreen />);
    await view.findByText('Main');

    await fireEvent.press(view.getByTestId('server-action-messages'));

    expect(mockNavigate).toHaveBeenCalledWith('Conversation', { serverId: 'srv-1', peer: 'admin' });
  });

  describe('plan and payment', () => {
    const subscription = {
      tierId: 't1',
      tierName: 'Pro',
      interval: 'monthly',
      status: 'active',
      paidUntil: '2026-04-03T12:00:00.000Z',
      lastPaymentAt: null,
      amountCents: 1990,
      currency: 'BRL',
      cancelAtPeriodEnd: false,
      canCancelHere: true,
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
});
