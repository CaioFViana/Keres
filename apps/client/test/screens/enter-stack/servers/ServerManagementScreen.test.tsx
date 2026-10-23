import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import ServerManagementScreen from '@/src/screens/enter-stack/servers/ServerManagementScreen';
import { withSilencedConsole } from '@/test/helpers/silenceConsole';

const mockT = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockNavigate = jest.fn();
const mockNavigation = { navigate: (...args: unknown[]) => mockNavigate(...args) };
const mockUseScreenHeader = jest.fn();
const mockDrizzle = {};
const mockGetAllServers = jest.fn();
const mockApiGet = jest.fn();
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

const mockIsFocused = { value: true };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useIsFocused: () => mockIsFocused.value,
}));

jest.mock('@/src/theme', () => {
  const actual = jest.requireActual('@/src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: mockSetTheme, colors: mockColors }),
  };
});

jest.mock('@/src/hooks/nav/useScreenHeader', () => ({
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));

jest.mock('@/src/hooks/nav/useBackButtonHandler', () => ({
  useBackButtonHandler: () => {},
}));

jest.mock('@/src/db', () => ({
  useDrizzle: () => mockDrizzle,
}));

const mockUserSettings = { allowCommunityServers: false };
jest.mock('@/src/state/app/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockUserSettings) : mockUserSettings,
}));

// The hosted web client talks to the one server that serves it; the official server is then that origin.
const mockFlavor = { hosted: false };
jest.mock('@/src/utils/platform/clientFlavor', () => ({
  ...jest.requireActual('@/src/utils/platform/clientFlavor'),
  isHostedByApi: () => mockFlavor.hosted,
}));
jest.mock('@/src/services/auth/browserCookieSession', () => ({
  ...jest.requireActual('@/src/services/auth/browserCookieSession'),
  hostedApiOrigin: () => 'https://hosted.example',
}));

jest.mock('@/src/services/servers/ServerService', () => ({
  createServerService: () => ({
    getAllServers: (...args: unknown[]) => mockGetAllServers(...args),
  }),
}));

jest.mock('@/src/services/api/apiClient', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockApiGet(...args) },
  apiUrl: (base: string, path: string) => `${base}${path}`,
  isOfflineError: () => false,
}));

const online = {
  id: 'srv-1',
  name: 'Main',
  url: 'https://a.example',
  userName: 'alice',
  tag: 'alice',
  lastSyncDate: new Date('2026-01-02T03:04:05.000Z'),
};
const offline = {
  id: 'srv-2',
  name: 'Backup',
  url: 'https://b.example',
  userName: 'bob',
  tag: null,
  lastSyncDate: null,
};

describe('ServerManagementScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFocused.value = true;
    mockUserSettings.allowCommunityServers = false;
    mockFlavor.hosted = false;
    mockGetAllServers.mockResolvedValue([online, offline]);
    mockApiGet.mockImplementation((url: string) =>
      String(url).startsWith('https://a.example')
        ? Promise.resolve({ status: 200, data: { version: '1.2.3' } })
        : Promise.reject(new Error('unreachable')),
    );
  });

  afterEach(async () => {
    await cleanup();
  });

  it('lists every server with where it is, who the user is there, and its tag', async () => {
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Main');

    expect(view.getByText('Backup')).toBeTruthy();
    expect(view.getByText('https://a.example')).toBeTruthy();
    expect(view.getByText(/server_user_label:{"name":"alice"}.*@alice/)).toBeTruthy();
    expect(view.getByText(/server_user_label:{"name":"bob"}.*no_tag_set/)).toBeTruthy();
    expect(view.getByText(/last_sync/)).toBeTruthy();
  });

  it('pings each of them, and says in words which answer', async () => {
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Main');

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    expect(mockApiGet).toHaveBeenCalledWith(
      'https://a.example/kerescheck',
      expect.objectContaining({ timeout: 5000 }),
    );
    await view.findByText(/server_status_online.*server_api_version:{"version":"1.2.3"}/);
    await view.findByText('server_status_offline');
  });

  it('has no buttons of its own on a server: it only opens it', async () => {
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Main');

    expect(view.queryByTestId('icon-trash-outline-24')).toBeNull();
    expect(view.queryByTestId('icon-key-outline-24')).toBeNull();
    expect(view.queryByTestId('icon-person-circle-outline-24')).toBeNull();
    await fireEvent.press(view.getByLabelText('Backup'));
    expect(mockNavigate).toHaveBeenCalledWith('ServerDetail', { serverId: 'srv-2' });
  });

  it('registers a new server from the header action', async () => {
    mockUserSettings.allowCommunityServers = true;
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Main');

    const header = mockUseScreenHeader.mock.calls[0][0] as {
      actions: { onPress: () => void }[];
    };
    header.actions[0].onPress();

    expect(mockNavigate).toHaveBeenCalledWith('ServerRegistration', {});
  });

  it('shows the error and empty states', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetAllServers.mockRejectedValueOnce(new Error('db down'));
      const failed = await render(<ServerManagementScreen />);
      await failed.findByText('failed_to_load_servers');

      mockGetAllServers.mockResolvedValue([]);
      const empty = await render(<ServerManagementScreen />);
      // No server saved: the invitation to the official server stands where the list would be.
      await empty.findByTestId('default-server-card');
    });
  });

  it('survives losing and regaining focus without a re-render loop', async () => {
    // Switching drawer menus flips `isFocused` while the screen stays mounted. The loader
    // callback is kept in state for the render-phase comparison, so storing it unwrapped
    // would invoke it as a state updater on every toggle and loop into "Too many re-renders".
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Main');
    const callsAfterMount = mockGetAllServers.mock.calls.length;

    mockIsFocused.value = false;
    await act(async () => {
      await view.rerender(<ServerManagementScreen />);
    });
    expect(mockGetAllServers.mock.calls.length).toBe(callsAfterMount);

    mockIsFocused.value = true;
    await act(async () => {
      await view.rerender(<ServerManagementScreen />);
    });
    await view.findByText('Main');
    expect(mockGetAllServers.mock.calls.length).toBe(callsAfterMount + 1);
  });

  it('keeps what it knew about a server while asking again, instead of blinking back to checking', async () => {
    jest.useFakeTimers();
    try {
      const view = await render(<ServerManagementScreen />);
      await view.findByText(/server_status_online/);

      // Hold the next answer back: during the wait the old status must still be there.
      let release: (value: unknown) => void = () => {};
      mockApiGet.mockImplementation(() => new Promise((resolve) => (release = resolve)));
      await act(async () => {
        jest.advanceTimersByTime(7000);
      });
      expect(view.queryByText('server_status_checking')).toBeNull();
      expect(view.getByText(/server_status_online/)).toBeTruthy();

      await act(async () => {
        release({ status: 200, data: { version: '1.2.4' } });
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ServerManagementScreen: the official server and adding by address', () => {
  const official = {
    id: 'srv-0',
    name: 'Keres',
    url: 'https://keres.me',
    userName: 'ana',
    tag: 'ana',
    lastSyncDate: null,
  };

  /** The actions the screen last asked its header for. */
  const lastHeaderActions = () => {
    const calls = mockUseScreenHeader.mock.calls;
    return (
      calls[calls.length - 1][0] as {
        actions: { id: string; label: string; onPress: () => void }[];
      }
    ).actions;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFocused.value = true;
    mockUserSettings.allowCommunityServers = false;
    mockFlavor.hosted = false;
    mockApiGet.mockResolvedValue({ status: 200, data: { version: '1.2.3' } });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('invites to the official server when none is saved, and the card leads to signing in there', async () => {
    mockGetAllServers.mockResolvedValue([]);
    const view = await render(<ServerManagementScreen />);

    await view.findByTestId('default-server-card');
    expect(view.getByText('default_server_title')).toBeTruthy();
    expect(view.getByText('https://keres.me')).toBeTruthy();
    expect(view.queryByTestId('other-servers-title')).toBeNull();

    await fireEvent.press(view.getByTestId('default-server-cta'));
    expect(mockNavigate).toHaveBeenCalledWith('ServerRegistration', {
      address: 'https://keres.me',
    });
  });

  it('keeps the invitation while the setting is off, and lists a community server already saved under other servers', async () => {
    mockGetAllServers.mockResolvedValue([online]);
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Main');

    expect(view.getByTestId('default-server-card')).toBeTruthy();
    expect(view.getByTestId('other-servers-title')).toBeTruthy();
    expect(view.queryByTestId('add-server-by-url')).toBeNull();
    expect(lastHeaderActions()).toEqual([]);
  });

  it.each(['https://keres.me', 'https://keres.me/', 'https://KERES.me:443'])(
    'shows the official server at the top, in place of the card, when it is saved as %s',
    async (url) => {
      mockGetAllServers.mockResolvedValue([{ ...official, url }]);
      const view = await render(<ServerManagementScreen />);

      await view.findByText('Keres');
      expect(view.queryByTestId('default-server-card')).toBeNull();
      expect(view.queryByTestId('other-servers-title')).toBeNull();
    },
  );

  it('keeps the official server at the top and the other saved servers under their title', async () => {
    mockGetAllServers.mockResolvedValue([online, official]);
    const view = await render(<ServerManagementScreen />);

    await view.findByText('Keres');
    expect(view.getByText('Main')).toBeTruthy();
    expect(view.getByTestId('other-servers-title')).toBeTruthy();
    expect(view.queryByTestId('default-server-card')).toBeNull();
  });

  it('offers adding a server by address from the header and the footer only while the setting is on', async () => {
    mockUserSettings.allowCommunityServers = true;
    mockGetAllServers.mockResolvedValue([official]);
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Keres');

    expect(lastHeaderActions()).toEqual([
      expect.objectContaining({ id: 'action-0', label: 'add_server_by_url' }),
    ]);
    await fireEvent.press(view.getByTestId('add-server-by-url'));
    expect(mockNavigate).toHaveBeenCalledWith('ServerRegistration', {});

    mockNavigate.mockClear();
    lastHeaderActions()[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('ServerRegistration', {});
  });

  it('offers no adding by address on the hosted web client, even with the setting on', async () => {
    mockUserSettings.allowCommunityServers = true;
    mockFlavor.hosted = true;
    mockGetAllServers.mockResolvedValue([]);
    const view = await render(<ServerManagementScreen />);

    await view.findByTestId('default-server-card');
    expect(view.getByText('default_server_title_hosted')).toBeTruthy();
    expect(view.getByText('https://hosted.example')).toBeTruthy();
    expect(view.queryByTestId('add-server-by-url')).toBeNull();
    expect(lastHeaderActions()).toEqual([]);
  });
});

describe('ServerManagementScreen: which server has news', () => {
  const { useUnseenMessagesStore } = require('@/src/state/ui/unseenMessagesStore');

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFocused.value = true;
    mockGetAllServers.mockResolvedValue([online, offline]);
    mockApiGet.mockResolvedValue({ status: 200, data: { version: '1.2.3' } });
    useUnseenMessagesStore.getState().reset();
  });

  afterEach(async () => {
    await cleanup();
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: {} });
    });
  });

  it('marks the server whose administrators wrote, and no other', async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-2|admin': '09' } });
    });
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Backup');

    expect(view.getAllByTestId('server-unseen-admin')).toHaveLength(1);
    expect(view.getByLabelText(/Backup.*messages_unseen_admin_on/)).toBeTruthy();
    expect(view.queryByLabelText(/Main.*messages_unseen_admin_on/)).toBeNull();
  });

  it('marks nothing for the messages of friends', async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-1|u1': '09' } });
    });
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Main');

    expect(view.queryByTestId('server-unseen-admin')).toBeNull();
  });
});
