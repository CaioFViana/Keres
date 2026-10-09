const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockParentNavigate = jest.fn();
const mockNotify = jest.fn();
const mockRoute: { params?: { serverId?: string } } = {};
const mockNavigation = {
  goBack: (...args: unknown[]) => mockGoBack(...args),
  getParent: () => ({ navigate: (...args: unknown[]) => mockParentNavigate(...args) }),
};
const mockDrizzle = {};
const mockGetAllServers = jest.fn();
const mockAddFriendship = jest.fn();
const mockGetUserByTag = jest.fn();
const mockSendFriendRequest = jest.fn();
const mockUserSettings = { userId: 'local-user' as string | null };
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

jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: () => ({ showNotification: (...args: unknown[]) => mockNotify(...args) }),
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockUserSettings) : mockUserSettings,
}));

jest.mock('../../../src/services/ServerService', () => ({
  createServerService: () => ({
    getAllServers: (...args: unknown[]) => mockGetAllServers(...args),
  }),
}));

jest.mock('../../../src/services/FriendshipService', () => ({
  createFriendshipService: () => ({
    addFriendship: (...args: unknown[]) => mockAddFriendship(...args),
  }),
}));

jest.mock('../../../src/services/UserApiService', () => ({
  userApiService: { getUserByTag: (...args: unknown[]) => mockGetUserByTag(...args) },
}));

jest.mock('../../../src/services/FriendshipApiService', () => ({
  friendshipApiService: {
    sendFriendRequest: (...args: unknown[]) => mockSendFriendRequest(...args),
  },
}));

type PillProps = {
  options: Array<{ label: string; value: string }>;
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder: string;
};

jest.mock('../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    SingleSelectPill: (props: PillProps) => (
      <>
        <Text testID="server-pill">{`${props.placeholder}:${props.value}`}</Text>
        {props.options.map((option) => (
          <Text
            key={option.value}
            testID={`server-${option.value}`}
            onPress={() => props.onValueChange(option.value)}
          >
            {option.label}
          </Text>
        ))}
      </>
    ),
  };
});

import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import FriendshipFormScreen from '../../../src/screens/enterstack/FriendshipFormScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const mainServer = { id: 'srv-1', name: 'Main', tag: 'main', idUser: 'me-on-server' };
const otherServer = { id: 'srv-2', name: 'Backup', tag: null, idUser: 'me-on-backup' };

const LOOKUP = { timeout: 3000 };

async function typeTag(view: Awaited<ReturnType<typeof render>>, tag: string) {
  await fireEvent.changeText(view.getByPlaceholderText('enter_friend_id'), tag);
}

describe('FriendshipFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = undefined;
    mockUserSettings.userId = 'local-user';
    mockGetAllServers.mockResolvedValue([mainServer]);
    mockAddFriendship.mockResolvedValue(undefined);
    mockGetUserByTag.mockResolvedValue({ id: 'friend-1', username: 'FriendName' });
    mockSendFriendRequest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('names the only server, picks it itself and looks the tag up as it is typed', async () => {
    const view = await render(<FriendshipFormScreen />);
    await view.findByPlaceholderText('enter_friend_id');
    // One server: nothing to choose, but it is still said where the friend is being added.
    expect(view.queryByTestId('server-pill')).toBeNull();
    expect(within(view.getByTestId('friend-form-server')).getByText('Main')).toBeTruthy();

    await typeTag(view, 'friend123');
    await waitFor(
      () => expect(mockGetUserByTag).toHaveBeenCalledWith(mainServer, 'friend123'),
      LOOKUP,
    );
    await view.findByText('friend_form_found');
    // The answer is in the form: no dialog, no "check" button.
    expect(mockAlert).not.toHaveBeenCalled();
    expect(view.queryByText('check_user')).toBeNull();
  });

  it('waits for the tag to stop changing before it asks the server', async () => {
    const view = await render(<FriendshipFormScreen />);
    await view.findByPlaceholderText('enter_friend_id');

    await typeTag(view, 'frie');
    await typeTag(view, 'frien');
    await typeTag(view, 'friend');
    await waitFor(
      () => expect(mockGetUserByTag).toHaveBeenCalledWith(mainServer, 'friend'),
      LOOKUP,
    );
    expect(mockGetUserByTag).toHaveBeenCalledTimes(1);
  });

  it('sends the request and saves the pending friendship', async () => {
    const view = await render(<FriendshipFormScreen />);
    await view.findByPlaceholderText('enter_friend_id');
    await typeTag(view, 'friend123');
    await view.findByText('friend_form_found', undefined, LOOKUP);

    await fireEvent.press(view.getByText('friend_send_request'));
    await waitFor(() => expect(mockSendFriendRequest).toHaveBeenCalledWith(mainServer, 'friend-1'));
    expect(mockAddFriendship).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: 'me-on-server',
        receiverId: 'friend-1',
        serverId: 'srv-1',
        friendUsername: 'FriendName',
      }),
    );
    expect(mockNotify).toHaveBeenCalledWith('friend_request_sent_notice', 'success');
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('looks the tag up itself when sending is pressed before the automatic lookup', async () => {
    const view = await render(<FriendshipFormScreen />);
    await view.findByPlaceholderText('enter_friend_id');
    await typeTag(view, 'friend123');

    await fireEvent.press(view.getByText('friend_send_request'));
    await waitFor(() => expect(mockSendFriendRequest).toHaveBeenCalledWith(mainServer, 'friend-1'));
    expect(mockGetUserByTag).toHaveBeenCalledTimes(1);
  });

  it('says so under the field when nobody has the tag, and does not send', async () => {
    mockGetUserByTag.mockResolvedValue(null);
    const view = await render(<FriendshipFormScreen />);
    await view.findByPlaceholderText('enter_friend_id');
    await typeTag(view, 'ghost');
    await view.findByText('friend_form_not_found', undefined, LOOKUP);

    await fireEvent.press(view.getByText('friend_send_request'));
    expect(mockSendFriendRequest).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('does not look up a tag too short to exist, and says why when sending is pressed', async () => {
    const view = await render(<FriendshipFormScreen />);
    await view.findByPlaceholderText('enter_friend_id');
    await typeTag(view, 'ab');
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(mockGetUserByTag).not.toHaveBeenCalled();

    await fireEvent.press(view.getByText('friend_send_request'));
    expect(mockAlert).toHaveBeenCalledWith('error', 'invalid_friend_id_format');
    expect(mockSendFriendRequest).not.toHaveBeenCalled();
  });

  it('reports a lookup that could not reach the server under the field', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetUserByTag.mockRejectedValue(new Error('boom'));
      const view = await render(<FriendshipFormScreen />);
      await view.findByPlaceholderText('enter_friend_id');
      await typeTag(view, 'friend123');
      await view.findByText('friend_form_check_failed', undefined, LOOKUP);
      expect(view.queryByText('friend_form_not_found')).toBeNull();
      expect(mockAlert).not.toHaveBeenCalled();
    });
  });

  it('ignores an answer for a tag that is no longer the one typed', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    mockGetUserByTag.mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve)),
    );
    const view = await render(<FriendshipFormScreen />);
    await view.findByPlaceholderText('enter_friend_id');

    await typeTag(view, 'friend111');
    await waitFor(() => expect(mockGetUserByTag).toHaveBeenCalledTimes(1), LOOKUP);
    await typeTag(view, 'friend222');
    await act(async () => {
      resolveFirst({ id: 'old', username: 'OldName' });
    });

    expect(view.queryByText('friend_form_found')).toBeNull();
    await waitFor(
      () => expect(mockGetUserByTag).toHaveBeenCalledWith(mainServer, 'friend222'),
      LOOKUP,
    );
    await view.findByText('friend_form_found', undefined, LOOKUP);
  });

  it('shows the server picker when there are several, and resets the lookup on a change', async () => {
    mockGetAllServers.mockResolvedValue([mainServer, otherServer]);
    const view = await render(<FriendshipFormScreen />);
    await view.findByText('Backup');
    expect(view.getByTestId('server-pill').props.children).toBe('select_server:null');
    await fireEvent.press(view.getByTestId('server-srv-1'));
    await typeTag(view, 'friend123');
    await view.findByText('friend_form_found', undefined, LOOKUP);

    await fireEvent.press(view.getByTestId('server-srv-2'));
    await waitFor(() => expect(view.queryByText('friend_form_found')).toBeNull());
  });

  it('starts on the server the person came from, among several', async () => {
    mockRoute.params = { serverId: 'srv-2' };
    mockGetAllServers.mockResolvedValue([mainServer, otherServer]);
    const view = await render(<FriendshipFormScreen />);
    await view.findByText('Backup');
    await waitFor(() =>
      expect(view.getByTestId('server-pill').props.children).toBe('select_server:srv-2'),
    );

    await typeTag(view, 'friend123');
    await waitFor(
      () => expect(mockGetUserByTag).toHaveBeenCalledWith(otherServer, 'friend123'),
      LOOKUP,
    );
  });

  it('asks the person to choose when there are several servers and none was asked for', async () => {
    mockGetAllServers.mockResolvedValue([mainServer, otherServer]);
    const view = await render(<FriendshipFormScreen />);
    await view.findByText('Backup');
    expect(view.getByTestId('server-pill').props.children).toBe('select_server:null');

    // A tag means a different person on each server: nothing is looked up until one is chosen.
    await typeTag(view, 'friend123');
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(mockGetUserByTag).not.toHaveBeenCalled();
  });

  it('explains that friends need a server, and offers to register one', async () => {
    mockGetAllServers.mockResolvedValue([]);
    const view = await render(<FriendshipFormScreen />);
    await view.findByText('friend_form_no_server_title');
    expect(view.getByText('friends_empty_no_server_message')).toBeTruthy();
    expect(view.queryByPlaceholderText('enter_friend_id')).toBeNull();

    await fireEvent.press(view.getByTestId('friend-form-register-server'));
    expect(mockParentNavigate).toHaveBeenCalledWith('ServerManagementDrawer', {
      screen: 'ServerManagement',
    });
  });

  it('does not claim there is no server before the servers are read', async () => {
    mockGetAllServers.mockImplementation(() => new Promise(() => {}));
    const view = await render(<FriendshipFormScreen />);
    expect(view.queryByText('friend_form_no_server_title')).toBeNull();
  });

  it('reports a failure to load the servers', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetAllServers.mockRejectedValue(new Error('db down'));
      await render(<FriendshipFormScreen />);
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_load_form_data'),
      );
    });
  });
});
