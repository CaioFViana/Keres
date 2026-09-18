const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockNavigate = jest.fn();
const mockUnsubscribe = jest.fn();
const mockFocusListeners: Array<() => void> = [];
const mockNavigation = {
  navigate: (...args: unknown[]) => mockNavigate(...args),
  addListener: (_event: string, cb: () => void) => {
    mockFocusListeners.push(cb);
    return mockUnsubscribe;
  },
};
const mockUseScreenHeader = jest.fn();
const mockDrizzle = {};
const mockGetAllFriendships = jest.fn();
const mockAccept = jest.fn();
const mockDecline = jest.fn();
const mockCancelSent = jest.fn();
const mockUnfriend = jest.fn();
const mockBlacklist = jest.fn();
const mockUnblacklist = jest.fn();
const mockGetAllServers = jest.fn();
const mockNotify = jest.fn();
const mockUserSettings = { userId: 'local-user' as string | null };
const mockNotificationState = { showNotification: (...args: unknown[]) => mockNotify(...args) };
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

jest.mock('../../../src/services/FriendshipService', () => ({
  createFriendshipService: () => ({
    getAllFriendships: (...args: unknown[]) => mockGetAllFriendships(...args),
    acceptFriendRequest: (...args: unknown[]) => mockAccept(...args),
    declineFriendRequest: (...args: unknown[]) => mockDecline(...args),
    cancelSentFriendRequest: (...args: unknown[]) => mockCancelSent(...args),
    unfriendUser: (...args: unknown[]) => mockUnfriend(...args),
    blacklistUser: (...args: unknown[]) => mockBlacklist(...args),
    unblacklistUser: (...args: unknown[]) => mockUnblacklist(...args),
  }),
}));

jest.mock('../../../src/services/ServerService', () => ({
  createServerService: () => ({
    getAllServers: (...args: unknown[]) => mockGetAllServers(...args),
  }),
}));

jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockNotificationState) : mockNotificationState,
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockUserSettings) : mockUserSettings,
}));

import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import FriendshipListScreen from '../../../src/screens/enterstack/FriendshipListScreen';
import { entityEventEmitter } from '../../../src/utils/EventEmitter';

const server = { id: 'srv-1', idUser: 'me-on-server', name: 'Main' };

function friendship(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    serverId: 'srv-1',
    status: FriendStatus.PENDING,
    senderId: 'them',
    receiverId: 'me-on-server',
    friendUsername: 'Zoe',
    otherUserTag: 'zoe',
    otherUserAvatarColor: null,
    otherUserAvatarIcon: null,
    otherUserId: 'them',
    serverName: 'Main',
    serverUrl: 'https://s.example',
    blockedById: null,
    ...overrides,
  };
}

const pendingReceived = friendship();
const pendingSent = friendship({
  id: 'f2',
  senderId: 'me-on-server',
  receiverId: 'them2',
  friendUsername: 'Max',
  otherUserTag: null,
  otherUserId: 'them2',
});
const friend = friendship({ id: 'f3', status: FriendStatus.FRIEND, friendUsername: 'Ana' });
const blacklistedByMe = friendship({
  id: 'f4',
  status: FriendStatus.BLACKLISTED,
  friendUsername: 'Rex',
  blockedById: 'me-on-server',
});
const blacklistedByOther = friendship({
  id: 'f5',
  status: FriendStatus.BLACKLISTED,
  friendUsername: 'Ivy',
  blockedById: 'them5',
});

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

async function focusLast() {
  const cb = mockFocusListeners[mockFocusListeners.length - 1];
  await act(async () => {
    cb();
  });
}

describe('FriendshipListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusListeners.length = 0;
    mockUserSettings.userId = 'local-user';
    mockGetAllServers.mockResolvedValue([server]);
    mockGetAllFriendships.mockResolvedValue([pendingReceived, pendingSent, friend]);
    mockAccept.mockResolvedValue(undefined);
    mockDecline.mockResolvedValue(undefined);
    mockCancelSent.mockResolvedValue(undefined);
    mockUnfriend.mockResolvedValue(undefined);
    mockBlacklist.mockResolvedValue(undefined);
    mockUnblacklist.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('groups friendships by status on focus', async () => {
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('status_pending');
    expect(view.getByText('status_friend')).toBeTruthy();
    expect(view.getByText('received_from')).toBeTruthy();
    expect(view.getByText('sent_to')).toBeTruthy();
    expect(view.getByText('Ana')).toBeTruthy();
    expect(view.getAllByText(/Main/)).toHaveLength(3);
    expect(view.getByText('your_friendships')).toBeTruthy();
  });

  it('opens the add form from the header action', async () => {
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('your_friendships');
    const header = mockUseScreenHeader.mock.calls[0][0] as {
      actions: Array<{ onPress: () => void }>;
    };
    header.actions[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('FriendshipForm');
  });

  it('navigates to the friend detail on row press', async () => {
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('Ana');
    await fireEvent.press(view.getByText('Ana'));
    expect(mockNavigate).toHaveBeenCalledWith('FriendDetail', { friendshipId: 'f3' });
  });

  it('accepts a received request after confirmation', async () => {
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('received_from');
    await fireEvent.press(view.getByTestId('icon-checkmark-circle-outline-24'));
    expect(mockAlert).toHaveBeenCalledWith(
      'accept_request_confirmation_title',
      'accept_request_confirmation_message',
      expect.any(Array),
      { cancelable: true },
    );
    const proceed = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'proceed');
    await act(async () => {
      await proceed?.onPress?.();
    });
    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith('f1', 'me-on-server'));
    expect(mockNotify).toHaveBeenCalledWith('request_accepted_successfully', 'success');
  });

  it('declines, cancels, unfriends, blacklists and unblacklists', async () => {
    mockGetAllFriendships.mockResolvedValue([
      pendingReceived,
      pendingSent,
      friend,
      blacklistedByMe,
      blacklistedByOther,
    ]);
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('status_blacklisted');

    async function confirm(testID: string, index: number, service: jest.Mock, id: string) {
      const callsBefore = mockAlert.mock.calls.length;
      const icons = view.getAllByTestId(testID);
      await fireEvent.press(icons[index]);
      const buttons = mockAlert.mock.calls[callsBefore][2] as AlertButton[];
      const proceed = buttons.find((b) => b.text === 'proceed');
      await act(async () => {
        await proceed?.onPress?.();
      });
      await waitFor(() => expect(service).toHaveBeenCalledWith(id, 'me-on-server'));
    }

    await confirm('icon-close-circle-outline-24', 0, mockDecline, 'f1');
    await confirm('icon-close-circle-outline-24', 1, mockCancelSent, 'f2');
    await confirm('icon-ban-outline-24', 0, mockBlacklist, 'f1');
    await confirm('icon-person-remove-outline-24', 0, mockUnfriend, 'f3');
    await confirm('icon-person-add-outline-24', 0, mockUnblacklist, 'f4');
    // Blocked by the other side offers no unblacklist button.
    expect(view.getAllByTestId('icon-person-add-outline-24')).toHaveLength(1);
  });

  it('reports action failures', async () => {
    mockAccept.mockRejectedValue(new Error('boom'));
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('received_from');
    await fireEvent.press(view.getByTestId('icon-checkmark-circle-outline-24'));
    const proceed = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'proceed');
    await act(async () => {
      await proceed?.onPress?.();
    });
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('failed_to_accept_request', 'error'),
    );
  });

  it('reloads when friendships change elsewhere', async () => {
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('received_from');
    expect(mockGetAllFriendships).toHaveBeenCalledTimes(1);
    await act(async () => {
      entityEventEmitter.emit('friendship_changed');
    });
    await waitFor(() => expect(mockGetAllFriendships).toHaveBeenCalledTimes(2));
  });

  it('shows the empty state and load failures', async () => {
    mockGetAllFriendships.mockResolvedValue([]);
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('no_friendships_found');

    mockGetAllServers.mockRejectedValueOnce(new Error('db down'));
    await act(async () => {
      entityEventEmitter.emit('friendship_changed');
    });
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_load_servers'));

    mockGetAllFriendships.mockRejectedValueOnce(new Error('db down'));
    await act(async () => {
      entityEventEmitter.emit('friendship_changed');
    });
    await waitFor(() =>
      expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_load_friendships'),
    );
  });

  it('requires a logged-in user', async () => {
    mockUserSettings.userId = null;
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('not_logged_in', 'error'));
    await view.findByText('no_friendships_found');
  });
});
