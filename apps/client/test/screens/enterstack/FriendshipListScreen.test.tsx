const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockNavigate = jest.fn();
const mockUnsubscribe = jest.fn();
const mockFocusListeners: Array<() => void> = [];
const mockParentNavigate = jest.fn();
const mockNavigation = {
  navigate: (...args: unknown[]) => mockNavigate(...args),
  getParent: () => ({ navigate: (...args: unknown[]) => mockParentNavigate(...args) }),
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

const mockSetClipboard = jest.fn(async (..._args: unknown[]) => undefined);
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => mockSetClipboard(...args),
}));

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

jest.mock('../../../src/components/features/story/StoryInvitationList/StoryInvitationList', () => ({
  __esModule: true,
  default: () => null,
}));

const mockSyncInvitations = jest.fn(async () => undefined);
jest.mock('../../../src/services/StoryInvitationService', () => ({
  __esModule: true,
  createStoryInvitationService: () => ({ syncWithServer: mockSyncInvitations }),
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
import { withSilencedConsole } from '../../helpers/silenceConsole';

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

  it('puts the friendships under their server, by what they ask of the person, with counts', async () => {
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('friend_requests_received · 1');
    // The server is always said, even when it is the only one: it is where these people are.
    expect(view.getByTestId('server-friends-srv-1')).toBeTruthy();
    expect(view.getByText('Main')).toBeTruthy();
    expect(view.getByText('friend_requests_sent · 1')).toBeTruthy();
    expect(view.getByText('friends_title · 1')).toBeTruthy();
    expect(view.getByText('friend_wants_to_be_friend')).toBeTruthy();
    expect(view.getByText('Max')).toBeTruthy();
    expect(view.getByText('Ana')).toBeTruthy();
    // Its address is never printed on a row.
    expect(view.queryByText(/s\.example/)).toBeNull();
  });

  it('keeps the same @tag on two servers apart, one block per server', async () => {
    const second = { id: 'srv-2', idUser: 'me-on-srv-2', name: 'Other', tag: 'caio2' };
    mockGetAllServers.mockResolvedValue([server, second]);
    mockGetAllFriendships.mockResolvedValue([
      friend,
      friendship({
        id: 'f9',
        serverId: 'srv-2',
        status: FriendStatus.FRIEND,
        friendUsername: 'Ana',
        otherUserTag: 'ana',
        otherUserId: 'ana-on-other',
        serverName: 'Other',
      }),
    ]);
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByTestId('server-friends-srv-2');

    // Two people who happen to share a name and a tag: two rows, each under its own server.
    expect(view.getAllByText('Ana')).toHaveLength(2);
    expect(view.getAllByText('friends_title · 1')).toHaveLength(2);
    expect(view.getByText('Other')).toBeTruthy();

    // Acting on the second one acts on that server, as the person who is signed in there.
    await fireEvent.press(view.getByTestId('friend-menu-f9'));
    await fireEvent.press(view.getByTestId('friend-menu-f9-unfriend'));
    const buttons = mockAlert.mock.calls[0][2] as AlertButton[];
    await act(async () => {
      await buttons.find((b) => b.text === 'proceed')?.onPress?.();
    });
    await waitFor(() => expect(mockUnfriend).toHaveBeenCalledWith('f9', 'me-on-srv-2'));
  });

  it('adds a friend on the server whose header was used', async () => {
    mockGetAllServers.mockResolvedValue([
      server,
      { id: 'srv-2', idUser: 'me-on-srv-2', name: 'Other' },
    ]);
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByTestId('add-friend-srv-2');

    await fireEvent.press(view.getByTestId('add-friend-srv-2'));
    expect(mockNavigate).toHaveBeenCalledWith('FriendshipForm', { serverId: 'srv-2' });
  });

  it('opens the add form from the header action', async () => {
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('friends_title · 1');
    const header = mockUseScreenHeader.mock.calls[0][0] as {
      actions: Array<{ onPress: () => void }>;
    };
    header.actions[0].onPress();
    // From the header there is no server in particular: the form asks which.
    expect(mockNavigate).toHaveBeenCalledWith('FriendshipForm', undefined);
  });

  it('opens the inbox from the header, next to the add action', async () => {
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('friends_title · 1');
    const header = mockUseScreenHeader.mock.calls[0][0] as {
      actions: Array<{ id: string; icon: string; onPress: () => void }>;
    };

    expect(header.actions.map((action) => action.icon)).toEqual(['add', 'chatbubbles-outline']);
    header.actions[1].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('MessageInbox');
  });

  it('changes the inbox icon when a message has not been opened', async () => {
    const { useUnseenMessagesStore } = require('../../../src/state/unseenMessagesStore');
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('friends_title · 1');
    const lastActions = () =>
      (
        mockUseScreenHeader.mock.calls.at(-1)![0] as {
          actions: Array<{ icon: string; label: string }>;
        }
      ).actions;
    expect(lastActions()[1]).toMatchObject({
      icon: 'chatbubbles-outline',
      label: 'messages_title',
    });

    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-1|u1': '09' } });
    });
    expect(lastActions()[1]).toMatchObject({
      icon: 'mail-unread-outline',
      label: 'messages_unseen',
    });

    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: {} });
    });
  });

  it('opens the conversation with a friend from their row, and only for friends', async () => {
    mockGetAllFriendships.mockResolvedValue([pendingReceived, friend]);
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('friends_title · 1');

    const icons = view.getAllByTestId('icon-chatbubble-outline-24');
    expect(icons).toHaveLength(1);
    await fireEvent.press(icons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      serverId: friend.serverId,
      peer: friend.otherUserId,
      peerName: friend.friendUsername,
    });
  });

  it('navigates to the friend detail on row press', async () => {
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('Ana');
    await fireEvent.press(view.getByText('Ana'));
    expect(mockNavigate).toHaveBeenCalledWith('FriendDetail', { friendshipId: 'f3' });
  });

  it('answers a request with spelled-out buttons, without a dialog', async () => {
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('friend_wants_to_be_friend');

    await fireEvent.press(view.getByTestId('friend-accept-f1'));
    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith('f1', 'me-on-server'));
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith('request_accepted_successfully', 'success');

    await fireEvent.press(view.getByTestId('friend-decline-f1'));
    await waitFor(() => expect(mockDecline).toHaveBeenCalledWith('f1', 'me-on-server'));
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('withdraws a sent request and unblocks at once, and only the blocker can unblock', async () => {
    mockGetAllFriendships.mockResolvedValue([pendingSent, blacklistedByMe, blacklistedByOther]);
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('friends_blocked_title · 2');

    await fireEvent.press(view.getByText('friend_cancel_request'));
    await waitFor(() => expect(mockCancelSent).toHaveBeenCalledWith('f2', 'me-on-server'));

    // Blocked by the other side offers no unblock button.
    expect(view.getAllByText('friend_unblock')).toHaveLength(1);
    await fireEvent.press(view.getByText('friend_unblock'));
    await waitFor(() => expect(mockUnblacklist).toHaveBeenCalledWith('f4', 'me-on-server'));
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('asks before removing a friend or blocking, from the row menu', async () => {
    mockGetAllFriendships.mockResolvedValue([pendingReceived, friend]);
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('Ana');

    async function confirm(menu: string, item: string, service: jest.Mock, id: string) {
      const callsBefore = mockAlert.mock.calls.length;
      await fireEvent.press(view.getByTestId(menu));
      await fireEvent.press(view.getByTestId(item));
      expect(mockAlert.mock.calls.length).toBe(callsBefore + 1);
      const buttons = mockAlert.mock.calls[callsBefore][2] as AlertButton[];
      const proceed = buttons.find((b) => b.text === 'proceed');
      await act(async () => {
        await proceed?.onPress?.();
      });
      await waitFor(() => expect(service).toHaveBeenCalledWith(id, 'me-on-server'));
    }

    await confirm('friend-menu-f3', 'friend-menu-f3-unfriend', mockUnfriend, 'f3');
    await confirm('friend-menu-f3', 'friend-menu-f3-block', mockBlacklist, 'f3');
    // A request can be blocked from its own menu, which has no unfriend.
    await fireEvent.press(view.getByTestId('friend-menu-f1'));
    expect(view.queryByTestId('friend-menu-f1-unfriend')).toBeNull();
    expect(view.getByTestId('friend-menu-f1-block')).toBeTruthy();
  });

  it('reports action failures', async () => {
    await withSilencedConsole(['error'], async () => {
      mockAccept.mockRejectedValue(new Error('boom'));
      const view = await render(<FriendshipListScreen />);
      await focusLast();
      await view.findByText('friend_wants_to_be_friend');
      await fireEvent.press(view.getByTestId('friend-accept-f1'));
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith('failed_to_accept_request', 'error'),
      );
    });
  });

  it('labels every icon button of a row', async () => {
    mockGetAllFriendships.mockResolvedValue([friend]);
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('Ana');

    expect(view.getByLabelText('send_message')).toBeTruthy();
    expect(view.getByLabelText('friend_more_actions')).toBeTruthy();
  });

  it('shows the own tag on its server, with a button to copy it', async () => {
    mockGetAllServers.mockResolvedValue([{ ...server, tag: 'caio' }]);
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByTestId('server-friends-srv-1');

    // This file's translations return the key.
    expect(view.getByText('friend_your_tag: @caio')).toBeTruthy();
    await fireEvent.press(view.getByTestId('copy-tag-srv-1'));
    expect(mockSetClipboard).toHaveBeenCalledWith('@caio');
    expect(mockNotify).toHaveBeenCalledWith('friend_tag_copied', 'success');
  });

  it('shows no tag line for a server that has not given one', async () => {
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('friends_title · 1');
    expect(view.queryByTestId('copy-tag-srv-1')).toBeNull();
  });

  it('says a server has no friends yet and offers to add the first there', async () => {
    mockGetAllFriendships.mockResolvedValue([]);
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('friends_server_empty');
    expect(view.getByTestId('server-friends-srv-1')).toBeTruthy();

    await fireEvent.press(view.getByTestId('add-friend-srv-1'));
    expect(mockNavigate).toHaveBeenCalledWith('FriendshipForm', { serverId: 'srv-1' });
  });

  it('sends a person with no server to register one, and says why', async () => {
    mockGetAllFriendships.mockResolvedValue([]);
    mockGetAllServers.mockResolvedValue([]);
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('friends_empty_no_server_message');

    await fireEvent.press(view.getByTestId('friends-empty-register'));
    expect(mockParentNavigate).toHaveBeenCalledWith('ServerManagementDrawer', {
      screen: 'ServerManagement',
    });
  });

  it('does not guess the empty state before the first load', async () => {
    mockGetAllFriendships.mockResolvedValue([]);
    const view = await render(<FriendshipListScreen />);
    expect(view.queryByText('friends_empty_title')).toBeNull();
    expect(view.queryByText('friends_empty_no_server_message')).toBeNull();
  });

  it('reports load failures', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetAllFriendships.mockResolvedValue([]);
      const view = await render(<FriendshipListScreen />);
      await focusLast();
      await view.findByText('friends_server_empty');

      mockGetAllServers.mockRejectedValueOnce(new Error('db down'));
      await act(async () => {
        entityEventEmitter.emit('friendship_changed');
      });
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_load_servers'),
      );

      mockGetAllFriendships.mockRejectedValueOnce(new Error('db down'));
      await act(async () => {
        entityEventEmitter.emit('friendship_changed');
      });
      await waitFor(() =>
        expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_load_friendships'),
      );
    });
  });

  it('requires a logged-in user', async () => {
    mockUserSettings.userId = null;
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('not_logged_in', 'error'));
    await view.findByText('friends_server_empty');
  });
});

describe('FriendshipListScreen: which chat has news', () => {
  const { useUnseenMessagesStore } = require('../../../src/state/unseenMessagesStore');
  const bo = friendship({
    id: 'f6',
    status: FriendStatus.FRIEND,
    friendUsername: 'Bo',
    otherUserId: 'them6',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusListeners.length = 0;
    mockUserSettings.userId = 'local-user';
    mockGetAllServers.mockResolvedValue([server]);
    mockGetAllFriendships.mockResolvedValue([friend, bo]);
    useUnseenMessagesStore.getState().reset();
  });

  afterEach(async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: {} });
    });
  });

  it('marks the chat button of the friend who wrote, and only theirs', async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-1|them6': '09' } });
    });
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('Bo');

    expect(view.getAllByTestId('friend-unseen-mark')).toHaveLength(1);
    expect(view.getAllByLabelText('messages_unseen_from')).toHaveLength(1);
    // Ana's button is the plain one.
    expect(view.getAllByTestId('icon-chatbubble-outline-24')).toHaveLength(1);
  });

  it('marks nobody for the messages of the administrators', async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-1|admin': '09' } });
    });
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('Bo');

    expect(view.queryByTestId('friend-unseen-mark')).toBeNull();
  });

  it('drops the mark once the conversation was opened from the button', async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-1|them6': '09' } });
    });
    const view = await render(<FriendshipListScreen />);
    await focusLast();
    await view.findByText('Bo');

    await fireEvent.press(view.getByLabelText('messages_unseen_from'));
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      serverId: 'srv-1',
      peer: 'them6',
      peerName: 'Bo',
    });

    await act(async () => {
      await useUnseenMessagesStore.getState().markSeen('srv-1|them6', '09');
    });
    expect(view.queryByTestId('friend-unseen-mark')).toBeNull();
  });
});
