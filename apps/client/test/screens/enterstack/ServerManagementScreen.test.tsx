const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = {
  goBack: (...args: unknown[]) => mockGoBack(...args),
  navigate: (...args: unknown[]) => mockNavigate(...args),
};
const mockUseScreenHeader = jest.fn();
const mockDrizzle = {};
const mockGetAllServers = jest.fn();
const mockGetOwnedStories = jest.fn();
const mockUpdateServer = jest.fn();
const mockDeleteServer = jest.fn();
const mockUpdateOwnTag = jest.fn();
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
  useIsFocused: () => true,
}));

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: mockSetTheme, colors: mockColors }),
  };
});

jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
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
import ServerManagementScreen from '../../../src/screens/enterstack/ServerManagementScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

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

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

function alertButtons(callIndex = 0): AlertButton[] {
  return mockAlert.mock.calls[callIndex][2] as AlertButton[];
}

describe('ServerManagementScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllServers.mockResolvedValue([online, offline]);
    mockApiGet.mockImplementation((url: string) =>
      String(url).startsWith('https://a.example')
        ? Promise.resolve({ status: 200, data: { version: '1.2.3' } })
        : Promise.reject(new Error('unreachable')),
    );
    mockGetOwnedStories.mockResolvedValue([]);
    mockDeleteServer.mockResolvedValue(undefined);
    mockUpdateServer.mockResolvedValue(undefined);
    mockUpdateOwnTag.mockResolvedValue({ tag: 'newtag' });
  });

  afterEach(() => {
    cleanup();
  });

  it('loads servers and pings each of them', async () => {
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Main');
    expect(view.getByText('Backup')).toBeTruthy();
    expect(view.getByText('https://a.example')).toBeTruthy();
    expect(view.getAllByText(/User:/)).toHaveLength(2);
    expect(view.getByText(/last_sync/)).toBeTruthy();
    expect(view.getByText('@alice')).toBeTruthy();
    expect(view.getByText('no_tag_set')).toBeTruthy();
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledTimes(2));
    expect(mockApiGet).toHaveBeenCalledWith(
      'https://a.example/kerescheck',
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('shows the error and empty states', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetAllServers.mockRejectedValueOnce(new Error('db down'));
      const failed = await render(<ServerManagementScreen />);
      await failed.findByText('failed_to_load_servers');

      mockGetAllServers.mockResolvedValue([]);
      const empty = await render(<ServerManagementScreen />);
      await empty.findByText('no_servers_found');
    });
  });

  it('navigates to profile, password and edit screens', async () => {
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Main');
    await fireEvent.press(view.getAllByTestId('icon-person-circle-outline-24')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('MyProfile', { serverId: 'srv-1' });
    await fireEvent.press(view.getAllByTestId('icon-key-outline-24')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword', { serverId: 'srv-1' });
    await fireEvent.press(view.getAllByTestId('icon-pencil-outline-24')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('ServerRegistration', { serverId: 'srv-1' });

    const header = mockUseScreenHeader.mock.calls[0][0] as {
      actions: Array<{ onPress: () => void }>;
    };
    header.actions[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('ServerRegistration', {});
  });

  it('edits and saves a server tag', async () => {
    const view = await render(<ServerManagementScreen />);
    await view.findByText('@alice');
    await fireEvent.press(view.getByText('@alice'));
    const input = view.getByTestId('tag-input');
    expect(input.props.value).toBe('alice');
    await fireEvent.changeText(input, 'newtag');
    await fireEvent.press(view.getByTestId('icon-checkmark-outline-20'));
    await waitFor(() =>
      expect(mockUpdateOwnTag).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'srv-1' }),
        'newtag',
      ),
    );
    expect(mockUpdateServer).toHaveBeenCalledWith('srv-1', { tag: 'newtag' });
    await view.findByText('@newtag');
  });

  it('cancels tag editing and ignores unchanged tags', async () => {
    const view = await render(<ServerManagementScreen />);
    await view.findByText('@alice');
    await fireEvent.press(view.getByText('@alice'));
    await fireEvent.press(view.getByTestId('icon-checkmark-outline-20'));
    expect(mockUpdateOwnTag).not.toHaveBeenCalled();
    await view.findByText('@alice');

    await fireEvent.press(view.getByText('@alice'));
    await fireEvent.press(view.getByTestId('icon-close-outline-20'));
    await view.findByText('@alice');
    expect(mockUpdateOwnTag).not.toHaveBeenCalled();
  });

  it('maps tag save failures to specific messages', async () => {
    const view = await render(<ServerManagementScreen />);
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
      await fireEvent.press(view.getByTestId('icon-checkmark-outline-20'));
      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', message));
      await fireEvent.press(view.getByTestId('icon-close-outline-20'));
      await view.findByText('@alice');
    }
  });

  it('deletes a server after confirmation', async () => {
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Backup');
    await fireEvent.press(view.getAllByTestId('icon-trash-outline-24')[1]);
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
    await waitFor(() => expect(mockDeleteServer).toHaveBeenCalledWith('srv-2'));
    expect(mockAlert).toHaveBeenCalledWith('success', 'server_deleted_successfully');
    expect(view.queryByText('Backup')).toBeNull();
  });

  it('blocks deletion while the server owns stories', async () => {
    mockGetOwnedStories.mockResolvedValue([{ title: 'Epic' }]);
    const view = await render(<ServerManagementScreen />);
    await view.findByText('Main');
    await fireEvent.press(view.getAllByTestId('icon-trash-outline-24')[0]);
    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith(
        'cannot_delete_server_owned_stories_title',
        'cannot_delete_server_owned_stories_message',
      ),
    );
    expect(mockDeleteServer).not.toHaveBeenCalled();
  });

  it('reports deletion failures', async () => {
    await withSilencedConsole(['error'], async () => {
      const view = await render(<ServerManagementScreen />);
      await view.findByText('Main');

      mockGetOwnedStories.mockRejectedValueOnce(new Error('db down'));
      await fireEvent.press(view.getAllByTestId('icon-trash-outline-24')[0]);
      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_delete_server'));

      const { ServerHasOwnedStoriesError } = jest.requireMock(
        '../../../src/services/ServerService',
      ) as { ServerHasOwnedStoriesError: new (s: Array<{ title: string }>) => Error };
      mockDeleteServer.mockRejectedValueOnce(new ServerHasOwnedStoriesError([{ title: 'Epic' }]));
      await fireEvent.press(view.getAllByTestId('icon-trash-outline-24')[0]);
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith(
          'delete_server_title',
          'delete_server_message',
          expect.any(Array),
          { cancelable: true },
        ),
      );
      const owned = alertButtons(mockAlert.mock.calls.length - 1).find((b) => b.text === 'delete');
      await act(async () => {
        await owned?.onPress?.();
      });
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith(
          'cannot_delete_server_owned_stories_title',
          'cannot_delete_server_owned_stories_message',
        ),
      );

      mockDeleteServer.mockRejectedValueOnce(new Error('boom'));
      await fireEvent.press(view.getAllByTestId('icon-trash-outline-24')[0]);
      const del = alertButtons(mockAlert.mock.calls.length - 1).find((b) => b.text === 'delete');
      await act(async () => {
        await del?.onPress?.();
      });
      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_delete_server'));
    });
  });
});
