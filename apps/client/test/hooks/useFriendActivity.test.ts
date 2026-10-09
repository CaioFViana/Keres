const mockGetShared = jest.fn();
const mockGetConversations = jest.fn();

jest.mock('../../src/services/FriendshipApiService', () => ({
  friendshipApiService: { getSharedStories: (...args: unknown[]) => mockGetShared(...args) },
}));
jest.mock('../../src/services/MessageApiService', () => ({
  messageApi: { getConversations: (...args: unknown[]) => mockGetConversations(...args) },
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useFriendActivity } from '../../src/hooks/useFriendActivity';

const server = { id: 'srv-1' } as never;
const message = { id: 'm1', body: 'oi', createdAt: '2026-10-01T10:00:00Z', mine: true };
const stories = [{ storyId: 's1', title: 'Casa', ownedByMe: true, permissionType: 'writer' }];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetShared.mockResolvedValue(stories);
  mockGetConversations.mockResolvedValue([
    { kind: 'admin', peerUserId: null, lastMessage: { ...message, body: 'admin' } },
    { kind: 'direct', peerUserId: 'other', lastMessage: { ...message, body: 'other' } },
    { kind: 'direct', peerUserId: 'friend-1', lastMessage: message },
  ]);
});

describe('useFriendActivity', () => {
  it('reads the stories in common and the conversation with this friend, and no other', async () => {
    const { result } = await renderHook(() => useFriendActivity(server, 'friend-1', true, 1));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sharedStories).toEqual(stories);
    expect(result.current.lastMessage).toEqual(message);
    expect(mockGetShared).toHaveBeenCalledWith(server, 'friend-1');
  });

  it('asks nothing for somebody who is not a friend', async () => {
    const { result } = await renderHook(() => useFriendActivity(server, 'friend-1', false, 1));

    expect(mockGetShared).not.toHaveBeenCalled();
    expect(mockGetConversations).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({
      sharedStories: null,
      lastMessage: null,
      loading: false,
    });
  });

  it('shows the conversation when only the stories could not be read, and says so', async () => {
    mockGetShared.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useFriendActivity(server, 'friend-1', true, 1));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sharedStories).toBeNull();
    expect(result.current.sharedStoriesFailed).toBe(true);
    expect(result.current.lastMessage).toEqual(message);
  });

  it('shows the stories when only the conversations could not be read', async () => {
    mockGetConversations.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(() => useFriendActivity(server, 'friend-1', true, 1));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sharedStories).toEqual(stories);
    expect(result.current.sharedStoriesFailed).toBe(false);
    expect(result.current.lastMessage).toBeNull();
  });

  it('has no last message for a friend with no conversation', async () => {
    mockGetConversations.mockResolvedValue([]);
    const { result } = await renderHook(() => useFriendActivity(server, 'friend-1', true, 1));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.lastMessage).toBeNull();
  });

  it('reads again when the refresh key changes, and forgets everything when the friend stops being one', async () => {
    const { result, rerender } = await renderHook(
      ({ key, friend }: { key: number; friend: boolean }) =>
        useFriendActivity(server, 'friend-1', friend, key),
      { initialProps: { key: 1, friend: true } },
    );
    await waitFor(() => expect(result.current.sharedStories).toEqual(stories));

    await rerender({ key: 2, friend: true });
    await waitFor(() => expect(mockGetShared).toHaveBeenCalledTimes(2));

    await rerender({ key: 3, friend: false });
    expect(result.current.sharedStories).toBeNull();
  });
});
