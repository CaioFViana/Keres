const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockHeader = jest.fn();
const mockCanGoBack = jest.fn();
const mockUnsubscribe = jest.fn();
const mockFocusListeners: Array<() => void> = [];
const mockNavigation = {
  navigate: (...args: unknown[]) => mockNavigate(...args),
  goBack: (...args: unknown[]) => mockGoBack(...args),
  canGoBack: (...args: unknown[]) => mockCanGoBack(...args),
  addListener: (_event: string, cb: () => void) => {
    mockFocusListeners.push(cb);
    return mockUnsubscribe;
  },
};
const mockRoute: { params: { friendshipId: string } } = { params: { friendshipId: 'f1' } };
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
  useScreenHeader: (options: unknown) => mockHeader(options),
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

const mockCompact: { current: boolean } = { current: false };
jest.mock('../../../src/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ isCompact: mockCompact.current }),
}));

const NO_ACTIVITY = {
  sharedStories: null as unknown[] | null,
  sharedStoriesFailed: false,
  lastMessage: null as { id: string; body: string; createdAt: string; mine: boolean } | null,
  loading: false,
};
const mockActivity = { current: { ...NO_ACTIVITY } };
jest.mock('../../../src/hooks/useFriendActivity', () => ({
  useFriendActivity: () => mockActivity.current,
}));

const mockInvitationActions = {
  accept: jest.fn(),
  decline: jest.fn(),
  withdraw: jest.fn(),
};
const mockInvitations: {
  current: { received: unknown[]; sent: unknown[]; busyId: string | null };
} = { current: { received: [], sent: [], busyId: null } };
jest.mock('../../../src/hooks/useStoryInvitationList', () => ({
  useStoryInvitationList: () => ({ ...mockInvitations.current, ...mockInvitationActions }),
}));

const mockOpenStory = jest.fn();
jest.mock('../../../src/hooks/useOpenStoryById', () => ({
  useOpenStoryById: () => mockOpenStory,
}));

const mockInviteHook = jest.fn();
const mockInviteState: {
  current: {
    stories: { id: string; title: string }[] | null;
    busy: boolean;
    invite: jest.Mock;
  };
} = { current: { stories: null, busy: false, invite: jest.fn(async () => true) } };
jest.mock('../../../src/hooks/useInviteFriendToStory', () => ({
  useInviteFriendToStory: (options: unknown) => {
    mockInviteHook(options);
    return mockInviteState.current;
  },
}));

const mockInviteModal = jest.fn();
jest.mock('../../../src/components/features/friendship/InviteToStoryModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      visible: boolean;
      friendName: string;
      serverName: string;
      stories: unknown;
    }) => {
      mockInviteModal(props);
      return props.visible ? <Text testID="invite-modal">invite</Text> : null;
    },
  };
});

jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockNotificationState) : mockNotificationState,
}));

import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { withSilencedConsole } from '../../helpers/silenceConsole';
import FriendDetailScreen from '../../../src/screens/enterstack/FriendDetailScreen';

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
    otherUserBio: 'Hello there',
    otherUserAvatarColor: null,
    otherUserAvatarIcon: null,
    otherUserId: 'them',
    serverName: 'Main',
    blockedById: null,
    ...overrides,
  };
}

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

describe('FriendDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompact.current = false;
    mockActivity.current = { ...NO_ACTIVITY };
    mockInvitations.current = { received: [], sent: [], busyId: null };
    mockInviteState.current = { stories: null, busy: false, invite: jest.fn(async () => true) };
    mockFocusListeners.length = 0;
    mockRoute.params = { friendshipId: 'f1' };
    mockCanGoBack.mockReturnValue(true);
    mockGetAllServers.mockResolvedValue([server]);
    mockGetAllFriendships.mockResolvedValue([friendship()]);
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

  it('shows a received request with accept, decline and blacklist', async () => {
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');
    expect(view.getByText('status_pending')).toBeTruthy();
    expect(view.getByText(/zoe/)).toBeTruthy();
    expect(view.getByText('Hello there')).toBeTruthy();
    expect(view.getByText('friend_accept')).toBeTruthy();
    expect(view.getByText('friend_decline')).toBeTruthy();
    // Blocking is not one of the buttons: it is behind "More".
    expect(view.queryByText('friend_block')).toBeNull();
    expect(view.getByText('friend_more')).toBeTruthy();

    // Answering a request is harmless to do by mistake: no dialog in the way.
    await fireEvent.press(view.getByText('friend_accept'));
    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith('f1', 'me-on-server'));
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith('request_accepted_successfully', 'success');

    await fireEvent.press(view.getByText('friend_decline'));
    await waitFor(() => expect(mockDecline).toHaveBeenCalledWith('f1', 'me-on-server'));
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('asks before blocking', async () => {
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');

    await fireEvent.press(view.getByTestId('friend-detail-menu'));
    await fireEvent.press(view.getByTestId('friend-detail-menu-block'));
    expect(mockAlert).toHaveBeenCalledWith(
      'blacklist_confirmation_title',
      'blacklist_confirmation_message',
      expect.any(Array),
      { cancelable: true },
    );
    const proceed = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'proceed');
    await act(async () => {
      await proceed?.onPress?.();
    });
    await waitFor(() => expect(mockBlacklist).toHaveBeenCalledWith('f1', 'me-on-server'));
  });

  it('says which server this person is on, since the same @tag elsewhere is someone else', async () => {
    mockGetAllFriendships.mockResolvedValue([friendship({ serverName: 'Backup server' })]);
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');

    expect(within(view.getByTestId('friend-server')).getByText('Backup server')).toBeTruthy();
  });

  it('offers the way to message a friend in the header, and only for a friend', async () => {
    mockGetAllFriendships.mockResolvedValue([
      friendship({ status: FriendStatus.FRIEND, senderId: 'me-on-server', receiverId: 'them' }),
    ]);
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');

    const action = mockHeader.mock.calls.at(-1)![0].actions[0];
    expect(action).toMatchObject({ icon: 'chatbubble-outline', visible: true });
    action.onPress();
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      serverId: 'srv-1',
      peer: 'them',
      peerName: 'Zoe',
    });
  });

  it('hides the message action while it is only a request', async () => {
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');

    expect(mockHeader.mock.calls.at(-1)![0].actions[0].visible).toBe(false);
    // Nothing to open before the friendship is loaded.
    mockHeader.mock.calls[0][0].actions[0].onPress();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a sent request with a single cancel action', async () => {
    mockGetAllFriendships.mockResolvedValue([
      friendship({
        senderId: 'me-on-server',
        receiverId: 'them',
        otherUserBio: null,
        otherUserTag: null,
      }),
    ]);
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');
    expect(view.getByText('friend_cancel_request')).toBeTruthy();
    expect(view.queryByText('friend_accept')).toBeNull();
    expect(view.queryByText('bio')).toBeNull();

    await fireEvent.press(view.getByText('friend_cancel_request'));
    await waitFor(() => expect(mockCancelSent).toHaveBeenCalledWith('f1', 'me-on-server'));
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('shows a friend with unfriend and blacklist actions', async () => {
    mockGetAllFriendships.mockResolvedValue([friendship({ status: FriendStatus.FRIEND })]);
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');
    expect(view.getByText('status_friend')).toBeTruthy();
    // Removing and blocking end something: they wait behind "More", not next to the message button.
    expect(view.queryByText('friend_unfriend')).toBeNull();
    await fireEvent.press(view.getByTestId('friend-detail-menu'));
    expect(view.getByTestId('friend-detail-menu-block')).toBeTruthy();

    await fireEvent.press(view.getByTestId('friend-detail-menu-unfriend'));
    const proceed = (mockAlert.mock.calls[0][2] as AlertButton[]).find((b) => b.text === 'proceed');
    await act(async () => {
      await proceed?.onPress?.();
    });
    await waitFor(() => expect(mockUnfriend).toHaveBeenCalledWith('f1', 'me-on-server'));
  });

  it('opens the conversation from a button in the page, for a friend', async () => {
    mockGetAllFriendships.mockResolvedValue([friendship({ status: FriendStatus.FRIEND })]);
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');

    await fireEvent.press(view.getByText('send_message'));
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      serverId: 'srv-1',
      peer: 'them',
      peerName: 'Zoe',
    });
  });

  it('offers no message button for a request', async () => {
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');
    expect(view.queryByText('send_message')).toBeNull();
  });

  it('lets only the blocking side undo a blacklist', async () => {
    mockGetAllFriendships.mockResolvedValue([
      friendship({ status: FriendStatus.BLACKLISTED, blockedById: 'me-on-server' }),
    ]);
    const byMe = await render(<FriendDetailScreen />);
    await byMe.findByText('status_blacklisted');
    expect(byMe.getByText('friend_unblock')).toBeTruthy();
    await fireEvent.press(byMe.getByText('friend_unblock'));
    await waitFor(() => expect(mockUnblacklist).toHaveBeenCalledWith('f1', 'me-on-server'));
    expect(mockAlert).not.toHaveBeenCalled();

    mockGetAllFriendships.mockResolvedValue([
      friendship({ status: FriendStatus.BLACKLISTED, blockedById: 'them' }),
    ]);
    const byOther = await render(<FriendDetailScreen />);
    await byOther.findByText('blocked_by_other_user');
    expect(byOther.queryByText('friend_unblock')).toBeNull();
  });

  describe('what the friend and the person have going on', () => {
    const friendOf = (over: Record<string, unknown> = {}) =>
      friendship({
        status: FriendStatus.FRIEND,
        senderId: 'me-on-server',
        receiverId: 'them',
        ...over,
      });
    const story = (over: Record<string, unknown> = {}) => ({
      storyId: 's1',
      title: 'Casa de Ana',
      ownedByMe: true,
      permissionType: 'writer',
      ...over,
    });

    it('lists the stories they work on together, with who owns each and the role of the other', async () => {
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      mockActivity.current = {
        ...NO_ACTIVITY,
        sharedStories: [
          story(),
          story({ storyId: 's2', title: 'Casa dela', ownedByMe: false, permissionType: 'reader' }),
        ],
      };
      const view = await render(<FriendDetailScreen />);
      await view.findByText('Casa de Ana');

      expect(view.getByText('Casa dela')).toBeTruthy();
      // This file's translations return the key; the real ones fill in the name and the role.
      expect(view.getByText('friend_shared_yours')).toBeTruthy();
      expect(view.getByText('friend_shared_theirs')).toBeTruthy();
    });

    it('opens a shared story from its row', async () => {
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      mockActivity.current = { ...NO_ACTIVITY, sharedStories: [story()] };
      const view = await render(<FriendDetailScreen />);
      await view.findByText('Casa de Ana');

      await fireEvent.press(view.getByTestId('friend-shared-story-s1'));

      expect(mockOpenStory).toHaveBeenCalledWith('s1');
    });

    it('says there is nothing in common yet, and offers to invite', async () => {
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      mockActivity.current = { ...NO_ACTIVITY, sharedStories: [] };
      const view = await render(<FriendDetailScreen />);
      await view.findByText('friend_shared_empty');

      await fireEvent.press(view.getByTestId('friend-shared-invite'));

      expect(view.getByTestId('invite-modal')).toBeTruthy();
    });

    it('says the stories could not be loaded, without hiding the rest of the page', async () => {
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      mockActivity.current = { ...NO_ACTIVITY, sharedStoriesFailed: true };
      const view = await render(<FriendDetailScreen />);

      await view.findByText('friend_shared_failed');
      expect(view.getByTestId('friend-detail-message')).toBeTruthy();
    });

    it('shows no shared stories for a request or a block, only for a friend', async () => {
      mockActivity.current = { ...NO_ACTIVITY, sharedStories: [story()] };
      const view = await render(<FriendDetailScreen />);
      await view.findByText('Zoe');

      expect(view.queryByTestId('friend-shared-stories')).toBeNull();
    });

    it('does not offer an invitation for a story the friend already works on or was already invited to', async () => {
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      mockActivity.current = {
        ...NO_ACTIVITY,
        sharedStories: [
          story({ storyId: 'already', title: 'Já juntos' }),
          story({ storyId: 'theirs', title: 'Dela', ownedByMe: false }),
        ],
      };
      mockInvitations.current = {
        ...mockInvitations.current,
        sent: [
          {
            id: 'i1',
            serverId: 'srv-1',
            storyId: 'offered',
            storyTitle: 'Já convidada',
            inviterId: 'me-on-server',
            inviteeId: 'them',
            permissionType: 'reader',
          },
        ],
      };
      const view = await render(<FriendDetailScreen />);
      await view.findByText('Já juntos');

      const options = mockInviteHook.mock.calls.at(-1)![0] as { excludeStoryIds: string[] };
      expect([...options.excludeStoryIds].sort()).toEqual(['already', 'offered']);
    });

    it('hands the dialog the friend, the server and what the invitation hook read', async () => {
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      mockInviteState.current = {
        stories: [{ id: 's9', title: 'Livre' }],
        busy: true,
        invite: mockInviteState.current.invite,
      };
      const view = await render(<FriendDetailScreen />);
      await view.findByText('Zoe');

      const options = mockInviteHook.mock.calls.at(-1)![0] as {
        open: boolean;
        friendId: string;
        server: { id: string };
      };
      expect(options).toMatchObject({ open: false, friendId: 'them', server: { id: 'srv-1' } });
      const props = mockInviteModal.mock.calls.at(-1)![0] as {
        friendName: string;
        serverName: string;
        stories: unknown;
      };
      expect(props).toMatchObject({
        friendName: 'Zoe',
        serverName: 'Main',
        stories: [{ id: 's9', title: 'Livre' }],
      });
    });

    it('opens the invitation dialog from the invite button', async () => {
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      const view = await render(<FriendDetailScreen />);
      await view.findByText('Zoe');
      expect(view.queryByTestId('invite-modal')).toBeNull();

      await fireEvent.press(view.getByTestId('friend-detail-invite'));

      expect(view.getByTestId('invite-modal')).toBeTruthy();
    });

    it('shows the invitations between the two, and only between the two', async () => {
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      const invitation = (id: string, over: Record<string, unknown>) => ({
        id,
        serverId: 'srv-1',
        storyId: 's-' + id,
        storyTitle: 'Convite ' + id,
        inviterId: 'them',
        inviteeId: 'me-on-server',
        permissionType: 'writer',
        ...over,
      });
      mockInvitations.current = {
        busyId: null,
        received: [
          invitation('a', {}),
          invitation('b', { inviterId: 'someone-else' }),
          invitation('c', { serverId: 'srv-other' }),
        ],
        sent: [
          invitation('d', { inviterId: 'me-on-server', inviteeId: 'them' }),
          invitation('e', { inviterId: 'me-on-server', inviteeId: 'someone-else' }),
        ],
      };
      const view = await render(<FriendDetailScreen />);
      await view.findByTestId('friend-invitations');

      expect(view.getByText('Convite a')).toBeTruthy();
      expect(view.getByText('Convite d')).toBeTruthy();
      expect(view.queryByText('Convite b')).toBeNull();
      expect(view.queryByText('Convite c')).toBeNull();
      expect(view.queryByText('Convite e')).toBeNull();

      await fireEvent.press(view.getByTestId('friend-invitation-accept-a'));
      expect(mockInvitationActions.accept).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a' }),
      );
      await fireEvent.press(view.getByTestId('friend-invitation-decline-a'));
      expect(mockInvitationActions.decline).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a' }),
      );
      await fireEvent.press(view.getByTestId('friend-invitation-withdraw-d'));
      expect(mockInvitationActions.withdraw).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'd' }),
      );
    });

    it('shows how the conversation last ended, and continues it', async () => {
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      mockActivity.current = {
        ...NO_ACTIVITY,
        lastMessage: {
          id: 'm1',
          body: 'Vamos escrever?',
          createdAt: '2026-10-01T10:00:00Z',
          mine: false,
        },
      };
      const view = await render(<FriendDetailScreen />);
      await view.findByText('Vamos escrever?');

      // With a conversation under way the way in says "continue".
      expect(
        within(view.getByTestId('friend-detail-message')).getByText('friend_continue_conversation'),
      ).toBeTruthy();
      await fireEvent.press(
        view.getByLabelText('friend_continue_conversation', { exact: true, hidden: true }) ??
          view.getByText('Vamos escrever?'),
      );
      expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
        serverId: 'srv-1',
        peer: 'them',
        peerName: 'Zoe',
      });
    });

    it('does not show a conversation card before there is a conversation', async () => {
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      const view = await render(<FriendDetailScreen />);
      await view.findByText('Zoe');

      expect(view.queryByTestId('friend-conversation')).toBeNull();
      expect(
        within(view.getByTestId('friend-detail-message')).getByText('send_message'),
      ).toBeTruthy();
    });

    it('stacks the columns on a narrow screen without making them share a height that is not there', async () => {
      mockCompact.current = true;
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      mockActivity.current = {
        ...NO_ACTIVITY,
        sharedStories: [story()],
        lastMessage: { id: 'm1', body: 'oi', createdAt: '2026-10-01T10:00:00Z', mine: false },
      };
      const view = await render(<FriendDetailScreen />);
      await view.findByTestId('friend-conversation');

      const parentStyle = (testID: string) =>
        StyleSheet.flatten(view.getByTestId(testID).parent?.props.style);
      // Stacked: neither column takes a share (flex: 1 in a column with no height overlaps them).
      expect(parentStyle('friend-shared-stories').flex).toBeUndefined();
      expect(parentStyle('friend-conversation').flex).toBeUndefined();
    });

    it('lets the columns share the width side by side on a wide screen', async () => {
      mockGetAllFriendships.mockResolvedValue([friendOf()]);
      mockActivity.current = {
        ...NO_ACTIVITY,
        sharedStories: [story()],
        lastMessage: { id: 'm1', body: 'oi', createdAt: '2026-10-01T10:00:00Z', mine: false },
      };
      const view = await render(<FriendDetailScreen />);
      await view.findByTestId('friend-conversation');

      const parentStyle = (testID: string) =>
        StyleSheet.flatten(view.getByTestId(testID).parent?.props.style);
      expect(parentStyle('friend-shared-stories').flex).toBe(1);
      expect(parentStyle('friend-conversation').flex).toBe(1);
    });

    it('says since when they are friends', async () => {
      mockGetAllFriendships.mockResolvedValue([
        friendOf({ createdAt: new Date('2026-03-12T12:00:00Z') }),
      ]);
      const view = await render(<FriendDetailScreen />);

      await view.findByTestId('friend-since');
    });

    it('warns that the same @tag on another server is somebody else', async () => {
      mockGetAllFriendships.mockResolvedValue([
        friendOf(),
        friendship({
          id: 'other',
          serverId: 'srv-2',
          serverName: 'Backup',
          status: FriendStatus.FRIEND,
          otherUserTag: 'ZOE',
          otherUserId: 'zoe-elsewhere',
        }),
      ]);
      const view = await render(<FriendDetailScreen />);

      await view.findByTestId('friend-also-on');
    });

    it('says nothing of another server when the @tag is not used there', async () => {
      mockGetAllFriendships.mockResolvedValue([
        friendOf(),
        friendship({ id: 'other', serverId: 'srv-2', otherUserTag: 'someone', otherUserId: 'x' }),
      ]);
      const view = await render(<FriendDetailScreen />);
      await view.findByText('Zoe');

      expect(view.queryByTestId('friend-also-on')).toBeNull();
    });
  });

  describe('the buttons', () => {
    const asFriend = () =>
      mockGetAllFriendships.mockResolvedValue([
        friendship({ status: FriendStatus.FRIEND, senderId: 'me-on-server', receiverId: 'them' }),
      ]);

    it('share a narrow row in equal parts, with short words', async () => {
      mockCompact.current = true;
      asFriend();
      const view = await render(<FriendDetailScreen />);
      await view.findByTestId('friend-detail-actions');

      const style = (testID: string) => StyleSheet.flatten(view.getByTestId(testID).props.style);
      for (const id of ['friend-detail-message', 'friend-detail-invite', 'friend-detail-menu']) {
        expect(style(id)).toMatchObject({ flexGrow: 1, flexBasis: 0 });
      }
      expect(view.getByText('friend_message_short')).toBeTruthy();
      expect(view.getByText('friend_invite_short')).toBeTruthy();
    });

    it('keep the size of their words on a wide screen, with the whole words', async () => {
      asFriend();
      const view = await render(<FriendDetailScreen />);
      await view.findByTestId('friend-detail-actions');

      expect(
        StyleSheet.flatten(view.getByTestId('friend-detail-message').props.style).flexGrow,
      ).toBeUndefined();
      expect(view.getByText('send_message')).toBeTruthy();
      expect(view.getByText('friend_invite_to_story')).toBeTruthy();
    });

    it('offer a request only its answers and More', async () => {
      const view = await render(<FriendDetailScreen />);
      await view.findByTestId('friend-detail-actions');

      expect(view.getByTestId('friend-detail-accept')).toBeTruthy();
      expect(view.getByTestId('friend-detail-decline')).toBeTruthy();
      expect(view.getByTestId('friend-detail-menu')).toBeTruthy();
      expect(view.queryByTestId('friend-detail-invite')).toBeNull();
    });

    it('say who blocked whom: nothing to do for the one who was blocked', async () => {
      mockGetAllFriendships.mockResolvedValue([
        friendship({ status: FriendStatus.BLACKLISTED, blockedById: 'them' }),
      ]);
      const view = await render(<FriendDetailScreen />);
      await view.findByText('blocked_by_other_user');

      expect(view.queryByTestId('friend-detail-unblock')).toBeNull();
    });
  });

  it('navigates away once when the friendship is gone', async () => {
    mockGetAllFriendships.mockResolvedValue([]);
    const view = await render(<FriendDetailScreen />);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));

    const cbs = [...mockFocusListeners];
    await act(async () => {
      for (const cb of cbs) cb();
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(view).toBeTruthy();
  });

  it('reports load failures without leaving', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetAllFriendships.mockRejectedValue(new Error('db down'));
      const view = await render(<FriendDetailScreen />);
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith('failed_to_load_friendships', 'error'),
      );
      await view.findByText('friendship_not_found');
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });
});

describe('FriendDetailScreen: news from this friend', () => {
  const { useUnseenMessagesStore } = require('../../../src/state/unseenMessagesStore');
  const friendOf = (over: Record<string, unknown> = {}) =>
    friendship({
      status: FriendStatus.FRIEND,
      senderId: 'me-on-server',
      receiverId: 'them',
      ...over,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusListeners.length = 0;
    mockRoute.params = { friendshipId: 'f1' };
    mockGetAllServers.mockResolvedValue([server]);
    mockGetAllFriendships.mockResolvedValue([friendOf()]);
    useUnseenMessagesStore.getState().reset();
  });

  afterEach(async () => {
    await cleanup();
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: {} });
    });
  });

  const lastAction = () => mockHeader.mock.calls.at(-1)![0].actions[0];

  it('keeps the plain chat action when this friend wrote nothing new', async () => {
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');

    expect(lastAction()).toMatchObject({
      icon: 'chatbubble-outline',
      label: 'send_message',
      badge: false,
    });
  });

  it('shows a badge on the chat action, and names the friend in its label, when they wrote', async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-1|them': '09' } });
    });
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');

    expect(lastAction()).toMatchObject({ icon: 'chatbubble-ellipses', badge: true });
    // This file's translations return the key; the name is interpolated by the real ones (see FriendChatButton).
    expect(lastAction().label).toBe('messages_unseen_from');
  });

  it('is not badged by another friend or by the administrators', async () => {
    await act(async () => {
      useUnseenMessagesStore.setState({ unseen: { 'srv-1|other': '09', 'srv-1|admin': '09' } });
    });
    const view = await render(<FriendDetailScreen />);
    await view.findByText('Zoe');

    expect(lastAction().badge).toBe(false);
  });
});
