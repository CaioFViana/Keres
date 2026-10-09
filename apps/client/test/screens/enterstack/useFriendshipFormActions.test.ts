const mockAlert = jest.fn();
const mockNotify = jest.fn();
const mockGetUserByTag = jest.fn();
const mockSendFriendRequest = jest.fn();

jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('../../../src/state/notificationStore', () => ({
  useNotificationStore: () => ({ showNotification: (...args: unknown[]) => mockNotify(...args) }),
}));
jest.mock('../../../src/services/UserApiService', () => ({
  userApiService: { getUserByTag: (...args: unknown[]) => mockGetUserByTag(...args) },
}));
jest.mock('../../../src/services/FriendshipApiService', () => ({
  friendshipApiService: {
    sendFriendRequest: (...args: unknown[]) => mockSendFriendRequest(...args),
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { act, renderHook } from '@testing-library/react-native';
import {
  FRIEND_TAG_LOOKUP_DELAY_MS,
  useFriendshipFormActions,
} from '../../../src/screens/enterstack/useFriendshipFormActions';
import { withSilencedConsole } from '../../helpers/silenceConsole';
import type { FriendshipFormState } from '../../../src/screens/enterstack/useFriendshipFormState';
import type { FriendshipService } from '../../../src/services/FriendshipService';

const selectedServer = {
  id: 'server-1',
  name: 'Main',
  tag: 'main',
  idUser: 'me-on-server',
} as FriendshipFormState['selectedServer'];

const createState = (overrides: Partial<FriendshipFormState> = {}): FriendshipFormState =>
  ({
    friendTag: 'friend123',
    resolvedFriendUserId: 'friend-on-server',
    setResolvedFriendUserId: jest.fn(),
    selectedServerId: 'server-1',
    servers: [selectedServer!],
    friendUsername: 'FriendName',
    setFriendUsername: jest.fn(),
    isCheckingFriend: false,
    setIsCheckingFriend: jest.fn(),
    friendFound: true,
    setFriendFound: jest.fn(),
    checkFailed: false,
    setCheckFailed: jest.fn(),
    selectedServer,
    handleServerChange: jest.fn(),
    handleFriendTagChange: jest.fn(),
    ...overrides,
  }) as FriendshipFormState;

const friendshipService = {
  addFriendship: jest.fn(),
} as unknown as FriendshipService;

const navigation = {
  goBack: jest.fn(),
};

const renderActions = (state = createState()) =>
  renderHook(() =>
    useFriendshipFormActions({
      state,
      friendshipServiceRef: { current: friendshipService },
      navigation: navigation as never,
      currentUserId: 'local-user',
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserByTag.mockResolvedValue({ id: 'friend-on-server', username: 'FriendName' });
  mockSendFriendRequest.mockResolvedValue(undefined);
  (friendshipService.addFriendship as jest.Mock).mockResolvedValue(undefined);
});

describe('looking the tag up', () => {
  it('does not ask the server about a tag too short to exist, and says nothing about it', async () => {
    const state = createState({ friendTag: 'ab' });
    const view = await renderActions(state);

    let found: unknown;
    await act(async () => {
      found = await view.result.current.handleCheckFriendTag();
    });

    expect(found).toBeNull();
    expect(mockGetUserByTag).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('refuses a tag too long to exist before asking the server', async () => {
    const view = await renderActions(createState({ friendTag: 'a'.repeat(21) }));

    await act(async () => {
      await view.result.current.handleCheckFriendTag();
    });

    expect(mockGetUserByTag).not.toHaveBeenCalled();
  });

  it('looks the tag up the way it is stored, however it was typed', async () => {
    const view = await renderActions(createState({ friendTag: '  @Caio Viana ' }));

    await act(async () => {
      await view.result.current.handleCheckFriendTag();
    });

    expect(mockGetUserByTag).toHaveBeenCalledWith(selectedServer, 'caio_viana');
  });

  it('resolves a friend tag against the selected server, without a dialog', async () => {
    const state = createState({
      resolvedFriendUserId: null,
      friendUsername: null,
      friendFound: null,
    });
    const view = await renderActions(state);

    let found: unknown;
    await act(async () => {
      found = await view.result.current.handleCheckFriendTag();
    });

    expect(found).toEqual({ id: 'friend-on-server', username: 'FriendName' });
    expect(mockGetUserByTag).toHaveBeenCalledWith(selectedServer, 'friend123');
    expect(state.setFriendUsername).toHaveBeenCalledWith('FriendName');
    expect(state.setResolvedFriendUserId).toHaveBeenCalledWith('friend-on-server');
    expect(state.setFriendFound).toHaveBeenCalledWith(true);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('marks the friend as not found when the server has no such tag', async () => {
    mockGetUserByTag.mockResolvedValue(null);
    const state = createState();
    const view = await renderActions(state);

    let found: unknown;
    await act(async () => {
      found = await view.result.current.handleCheckFriendTag();
    });

    expect(found).toBeNull();
    expect(state.setFriendFound).toHaveBeenCalledWith(false);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('flags a server that could not be asked, apart from a tag that does not exist', async () => {
    await withSilencedConsole(['error'], async () => {
      mockGetUserByTag.mockRejectedValue(new Error('boom'));
      const state = createState();
      const view = await renderActions(state);

      await act(async () => {
        await view.result.current.handleCheckFriendTag();
      });

      expect(state.setCheckFailed).toHaveBeenCalledWith(true);
      expect(state.setFriendFound).not.toHaveBeenCalledWith(false);
      expect(state.setIsCheckingFriend).toHaveBeenLastCalledWith(false);
      expect(mockAlert).not.toHaveBeenCalled();
    });
  });

  it('forgets an answer that arrives after a newer lookup began', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    mockGetUserByTag
      .mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve)))
      .mockResolvedValueOnce({ id: 'new-id', username: 'NewName' });
    const state = createState({ resolvedFriendUserId: null, friendUsername: null });
    const view = await renderActions(state);

    let old: Promise<unknown> = Promise.resolve();
    await act(async () => {
      old = view.result.current.handleCheckFriendTag();
    });
    await act(async () => {
      await view.result.current.handleCheckFriendTag();
    });
    await act(async () => {
      resolveOld({ id: 'old-id', username: 'OldName' });
      await old;
    });

    expect(state.setFriendUsername).not.toHaveBeenCalledWith('OldName');
    expect(state.setFriendUsername).toHaveBeenCalledWith('NewName');
  });
});

describe('looking up by itself', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('looks up once the tag has stopped changing', async () => {
    await renderActions(createState({ resolvedFriendUserId: null, friendUsername: null }));

    expect(mockGetUserByTag).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(FRIEND_TAG_LOOKUP_DELAY_MS + 1);
    });
    expect(mockGetUserByTag).toHaveBeenCalledWith(selectedServer, 'friend123');
  });

  it('does not look up before a server is chosen, or for a tag that cannot exist', async () => {
    await renderActions(createState({ selectedServerId: '', selectedServer: undefined }));
    await renderActions(createState({ friendTag: 'ab' }));

    await act(async () => {
      jest.advanceTimersByTime(FRIEND_TAG_LOOKUP_DELAY_MS * 2);
    });
    expect(mockGetUserByTag).not.toHaveBeenCalled();
  });

  it('drops the lookup of a tag that was edited away before the delay passed', async () => {
    const view = await renderHook(
      ({ tag }: { tag: string }) =>
        useFriendshipFormActions({
          state: createState({ friendTag: tag }),
          friendshipServiceRef: { current: friendshipService },
          navigation: navigation as never,
          currentUserId: 'local-user',
        }),
      { initialProps: { tag: 'friend1' } },
    );

    await act(async () => {
      jest.advanceTimersByTime(FRIEND_TAG_LOOKUP_DELAY_MS - 100);
    });
    await view.rerender({ tag: 'friend12' });
    await act(async () => {
      jest.advanceTimersByTime(FRIEND_TAG_LOOKUP_DELAY_MS - 100);
    });
    expect(mockGetUserByTag).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(mockGetUserByTag).toHaveBeenCalledTimes(1);
    expect(mockGetUserByTag).toHaveBeenCalledWith(selectedServer, 'friend12');
  });
});

describe('sending the request', () => {
  it('blocks saving when the resolved friend is the current server user', async () => {
    const view = await renderActions(
      createState({ resolvedFriendUserId: 'me-on-server', friendUsername: 'Me' }),
    );

    await act(async () => {
      await view.result.current.handleSaveFriendship();
    });

    expect(mockAlert).toHaveBeenCalledWith('error', 'cannot_friend_self');
    expect(mockSendFriendRequest).not.toHaveBeenCalled();
    expect(friendshipService.addFriendship).not.toHaveBeenCalled();
  });

  it('sends the API request before writing a local pending friendship, and tells who it went to', async () => {
    const view = await renderActions();

    await act(async () => {
      await view.result.current.handleSaveFriendship();
    });

    expect(mockSendFriendRequest).toHaveBeenCalledWith(selectedServer, 'friend-on-server');
    expect(friendshipService.addFriendship).toHaveBeenCalledWith({
      senderId: 'me-on-server',
      receiverId: 'friend-on-server',
      serverId: 'server-1',
      status: FriendStatus.PENDING,
      friendUsername: 'FriendName',
    });
    expect(mockNotify).toHaveBeenCalledWith(
      'friend_request_sent_notice:{"name":"FriendName"}',
      'success',
    );
    expect(mockAlert).not.toHaveBeenCalled();
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('looks the tag up first when it was not resolved yet', async () => {
    const view = await renderActions(
      createState({ resolvedFriendUserId: null, friendUsername: null, friendFound: null }),
    );

    await act(async () => {
      await view.result.current.handleSaveFriendship();
    });

    expect(mockGetUserByTag).toHaveBeenCalledTimes(1);
    expect(mockSendFriendRequest).toHaveBeenCalledWith(selectedServer, 'friend-on-server');
  });

  it('sends nothing when that lookup finds no one', async () => {
    mockGetUserByTag.mockResolvedValue(null);
    const view = await renderActions(
      createState({ resolvedFriendUserId: null, friendUsername: null, friendFound: null }),
    );

    await act(async () => {
      await view.result.current.handleSaveFriendship();
    });

    expect(mockSendFriendRequest).not.toHaveBeenCalled();
    expect(friendshipService.addFriendship).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('does not write locally when the API rejects the friend request', async () => {
    await withSilencedConsole(['error'], async () => {
      mockSendFriendRequest.mockRejectedValue(new Error('already friends'));
      const view = await renderActions();

      await act(async () => {
        await view.result.current.handleSaveFriendship();
      });

      expect(friendshipService.addFriendship).not.toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_friendship');
      expect(navigation.goBack).not.toHaveBeenCalled();
    });
  });

  it('blocks saving without a logged-in user', async () => {
    const view = await renderHook(() =>
      useFriendshipFormActions({
        state: createState(),
        friendshipServiceRef: { current: friendshipService },
        navigation: navigation as never,
        currentUserId: null,
      }),
    );

    await act(async () => {
      await view.result.current.handleSaveFriendship();
    });

    expect(mockAlert).toHaveBeenCalledWith('error', 'not_logged_in');
    expect(mockSendFriendRequest).not.toHaveBeenCalled();
  });

  it('blocks saving a tag that cannot exist, with the reason', async () => {
    const view = await renderActions(createState({ friendTag: 'ab' }));

    await act(async () => {
      await view.result.current.handleSaveFriendship();
    });

    expect(mockAlert).toHaveBeenCalledWith('error', 'invalid_friend_id_format');
    expect(mockSendFriendRequest).not.toHaveBeenCalled();
  });

  it('blocks saving when the selected server has no account', async () => {
    const view = await renderActions(
      createState({ selectedServer: { ...selectedServer!, idUser: null as unknown as string } }),
    );

    await act(async () => {
      await view.result.current.handleSaveFriendship();
    });

    expect(mockAlert).toHaveBeenCalledWith('error', 'selected_server_invalid');
    expect(mockSendFriendRequest).not.toHaveBeenCalled();
  });

  it('blocks saving without a server chosen', async () => {
    const view = await renderActions(createState({ selectedServer: undefined }));

    await act(async () => {
      await view.result.current.handleSaveFriendship();
    });

    expect(mockAlert).toHaveBeenCalledWith('error', 'selected_server_invalid');
  });

  it('blocks saving without a friendship service', async () => {
    const view = await renderHook(() =>
      useFriendshipFormActions({
        state: createState(),
        friendshipServiceRef: { current: null },
        navigation: navigation as never,
        currentUserId: 'local-user',
      }),
    );

    await act(async () => {
      await view.result.current.handleSaveFriendship();
    });

    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_friendship');
    expect(mockSendFriendRequest).not.toHaveBeenCalled();
  });
});
