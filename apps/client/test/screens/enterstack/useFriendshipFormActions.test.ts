const mockAlert = jest.fn();
const mockGetUserByTag = jest.fn();
const mockSendFriendRequest = jest.fn();

jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
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
import { useFriendshipFormActions } from '../../../src/screens/enterstack/useFriendshipFormActions';
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

it('rejects an invalid friend tag before lookup', async () => {
  const state = createState({ friendTag: 'ab' });
  const view = await renderActions(state);

  await act(async () => {
    await view.result.current.handleCheckFriendTag();
  });

  expect(mockAlert).toHaveBeenCalledWith('error', 'invalid_friend_id_format');
  expect(mockGetUserByTag).not.toHaveBeenCalled();
  expect(state.setFriendUsername).toHaveBeenCalledWith(null);
  expect(state.setFriendFound).toHaveBeenCalledWith(null);
});

it('resolves a friend tag against the selected server', async () => {
  const state = createState({
    resolvedFriendUserId: null,
    friendUsername: null,
    friendFound: null,
  });
  const view = await renderActions(state);

  await act(async () => {
    await view.result.current.handleCheckFriendTag();
  });

  expect(mockGetUserByTag).toHaveBeenCalledWith(selectedServer, 'friend123');
  expect(state.setFriendUsername).toHaveBeenCalledWith('FriendName');
  expect(state.setResolvedFriendUserId).toHaveBeenCalledWith('friend-on-server');
  expect(state.setFriendFound).toHaveBeenCalledWith(true);
  expect(mockAlert).toHaveBeenCalledWith(
    'success',
    'user_found_with_username:{"username":"FriendName"}',
  );
});

it('blocks saving when the resolved friend is the current server user', async () => {
  const view = await renderActions(createState({ resolvedFriendUserId: 'me-on-server' }));

  await act(async () => {
    await view.result.current.handleSaveFriendship();
  });

  expect(mockAlert).toHaveBeenCalledWith('error', 'cannot_friend_self');
  expect(mockSendFriendRequest).not.toHaveBeenCalled();
  expect(friendshipService.addFriendship).not.toHaveBeenCalled();
});

it('sends the API request before writing a local pending friendship', async () => {
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
  expect(mockAlert).toHaveBeenCalledWith('success', 'friendship_added_successfully');
  expect(navigation.goBack).toHaveBeenCalled();
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

it('requires a selected server before lookup', async () => {
  const state = createState({ selectedServer: undefined });
  const view = await renderActions(state);

  await act(async () => {
    await view.result.current.handleCheckFriendTag();
  });

  expect(mockAlert).toHaveBeenCalledWith('error', 'selected_server_invalid');
  expect(mockGetUserByTag).not.toHaveBeenCalled();
});

it('marks the friend as not found when the server has no such tag', async () => {
  mockGetUserByTag.mockResolvedValue(null);
  const state = createState();
  const view = await renderActions(state);

  await act(async () => {
    await view.result.current.handleCheckFriendTag();
  });

  expect(state.setFriendFound).toHaveBeenCalledWith(false);
  expect(mockAlert).toHaveBeenCalledWith('error', 'user_not_found_on_server');
});

it('reports lookup failures', async () => {
  await withSilencedConsole(['error'], async () => {
    mockGetUserByTag.mockRejectedValue(new Error('boom'));
    const state = createState();
    const view = await renderActions(state);

    await act(async () => {
      await view.result.current.handleCheckFriendTag();
    });

    expect(state.setFriendFound).toHaveBeenCalledWith(false);
    expect(state.setIsCheckingFriend).toHaveBeenCalledWith(false);
    expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_check_user_id');
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

it('blocks saving before the friend tag is resolved', async () => {
  const view = await renderActions(createState({ resolvedFriendUserId: null }));

  await act(async () => {
    await view.result.current.handleSaveFriendship();
  });

  expect(mockAlert).toHaveBeenCalledWith('error', 'all_fields_required');
  expect(mockSendFriendRequest).not.toHaveBeenCalled();
});

it('blocks saving a friend that was not found', async () => {
  const view = await renderActions(createState({ friendFound: false, friendUsername: 'Ghost' }));

  await act(async () => {
    await view.result.current.handleSaveFriendship();
  });

  expect(mockAlert).toHaveBeenCalledWith('error', 'friend_not_found_on_server');
  expect(mockSendFriendRequest).not.toHaveBeenCalled();
});

it('blocks saving before the friend tag is checked', async () => {
  const view = await renderActions(createState({ friendUsername: null }));

  await act(async () => {
    await view.result.current.handleSaveFriendship();
  });

  expect(mockAlert).toHaveBeenCalledWith('error', 'please_check_friend_id');
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
