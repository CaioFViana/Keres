const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { goBack: (...args: unknown[]) => mockGoBack(...args) };
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

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import FriendshipFormScreen from '../../../src/screens/enterstack/FriendshipFormScreen';
import { withSilencedConsole } from '../../helpers/silenceConsole';

const mainServer = { id: 'srv-1', name: 'Main', tag: 'main', idUser: 'me-on-server' };
const otherServer = { id: 'srv-2', name: 'Backup', tag: null, idUser: 'me-on-backup' };

describe('FriendshipFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserSettings.userId = 'local-user';
    mockGetAllServers.mockResolvedValue([mainServer]);
    mockAddFriendship.mockResolvedValue(undefined);
    mockGetUserByTag.mockResolvedValue({ id: 'friend-1', username: 'FriendName' });
    mockSendFriendRequest.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('auto-selects a single server and checks a friend tag', async () => {
    const view = await render(<FriendshipFormScreen />);
    await view.findByText('add_new_friendship');
    await waitFor(() =>
      expect(view.getByTestId('server-pill').props.children).toBe('select_server:srv-1'),
    );
    expect(view.getByText('@main — Main')).toBeTruthy();
    await fireEvent.changeText(view.getByPlaceholderText('enter_friend_id'), 'friend123');
    await fireEvent.press(view.getByText('check_user'));
    await waitFor(() => expect(mockGetUserByTag).toHaveBeenCalledWith(mainServer, 'friend123'));
    expect(view.getByText(/user_found/)).toBeTruthy();
    expect(mockAlert).toHaveBeenCalledWith('success', 'user_found_with_username');
  });

  it('sends the request and saves the pending friendship', async () => {
    const view = await render(<FriendshipFormScreen />);
    await view.findByText('add_new_friendship');
    await waitFor(() =>
      expect(view.getByTestId('server-pill').props.children).toBe('select_server:srv-1'),
    );
    await fireEvent.changeText(view.getByPlaceholderText('enter_friend_id'), 'friend123');
    await fireEvent.press(view.getByText('check_user'));
    await view.findByText(/user_found/);
    await fireEvent.press(view.getByText('add_friendship'));
    await waitFor(() => expect(mockSendFriendRequest).toHaveBeenCalledWith(mainServer, 'friend-1'));
    expect(mockAddFriendship).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: 'me-on-server',
        receiverId: 'friend-1',
        serverId: 'srv-1',
        friendUsername: 'FriendName',
      }),
    );
    expect(mockAlert).toHaveBeenCalledWith('success', 'friendship_added_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('rejects invalid tags and unknown users', async () => {
    const view = await render(<FriendshipFormScreen />);
    await view.findByText('check_user');
    await waitFor(() =>
      expect(view.getByTestId('server-pill').props.children).toBe('select_server:srv-1'),
    );
    await fireEvent.changeText(view.getByPlaceholderText('enter_friend_id'), 'ab');
    await fireEvent.press(view.getByText('check_user'));
    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith('error', 'invalid_friend_id_format'),
    );
    expect(mockGetUserByTag).not.toHaveBeenCalled();

    mockGetUserByTag.mockResolvedValue(null);
    await fireEvent.changeText(view.getByPlaceholderText('enter_friend_id'), 'ghost');
    await fireEvent.press(view.getByText('check_user'));
    await view.findByText('user_not_found');
    expect(mockAlert).toHaveBeenCalledWith('error', 'user_not_found_on_server');
  });

  it('reports lookup failures', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetUserByTag.mockRejectedValue(new Error('boom'));
      const view = await render(<FriendshipFormScreen />);
      await view.findByText('check_user');
      await waitFor(() =>
        expect(view.getByTestId('server-pill').props.children).toBe('select_server:srv-1'),
      );
      await fireEvent.changeText(view.getByPlaceholderText('enter_friend_id'), 'friend123');
      await fireEvent.press(view.getByText('check_user'));
      await view.findByText('user_not_found');
      expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_check_user_id');
    });
  });

  it('resets the lookup when the server changes', async () => {
    mockGetAllServers.mockResolvedValue([mainServer, otherServer]);
    const view = await render(<FriendshipFormScreen />);
    await view.findByText('Backup');
    expect(view.getByTestId('server-pill').props.children).toBe('select_server:null');
    await fireEvent.press(view.getByTestId('server-srv-1'));
    await fireEvent.changeText(view.getByPlaceholderText('enter_friend_id'), 'friend123');
    await fireEvent.press(view.getByText('check_user'));
    await view.findByText(/user_found/);
    await fireEvent.press(view.getByTestId('server-srv-2'));
    await waitFor(() => expect(view.queryByText(/user_found/)).toBeNull());
  });

  it('shows placeholders without servers and reports load failures', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetAllServers.mockResolvedValue([]);
      const empty = await render(<FriendshipFormScreen />);
      await empty.findByText('add_new_friendship');
      await waitFor(() =>
        expect(empty.getByTestId('server-pill').props.children).toBe('no_servers_available:null'),
      );

      mockGetAllServers.mockRejectedValue(new Error('db down'));
      const failed = await render(<FriendshipFormScreen />);
      await failed.findByText('add_new_friendship');
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_load_form_data'),
      );
    });
  });
});
