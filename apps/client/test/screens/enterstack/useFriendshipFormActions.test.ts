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
  useTranslation: () => ({ t: (key: string, params?: Record<string, string>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { act, renderHook } from '@testing-library/react-native';
import { useFriendshipFormActions } from '../../../src/screens/enterstack/useFriendshipFormActions';
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
  const view = await renderActions(
    createState({ resolvedFriendUserId: 'me-on-server' }),
  );

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
  mockSendFriendRequest.mockRejectedValue(new Error('already friends'));
  const view = await renderActions();

  await act(async () => {
    await view.result.current.handleSaveFriendship();
  });

  expect(friendshipService.addFriendship).not.toHaveBeenCalled();
  expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_save_friendship');
  expect(navigation.goBack).not.toHaveBeenCalled();
});
