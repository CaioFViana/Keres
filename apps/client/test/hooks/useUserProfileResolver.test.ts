/** @jest-environment node */
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));
jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn(),
}));
jest.mock('../../src/services/FriendshipApiService', () => ({
  __esModule: true,
  friendshipApiService: { getUserDetails: jest.fn() },
}));

import { renderHook } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useUserProfileResolver } from '../../src/hooks/useUserProfileResolver';
import { friendshipApiService } from '../../src/services/FriendshipApiService';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const db = { query: { users: { findFirst: jest.fn() } } };

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue(db);
  (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({
    userId: 'local-user',
    username: 'Caio',
  });
  db.query.users.findFirst.mockResolvedValue(undefined);
  (friendshipApiService.getUserDetails as jest.Mock).mockResolvedValue(undefined);
});

it('prefers the locally synchronized profile, including its avatar data', async () => {
  db.query.users.findFirst.mockResolvedValue({
    displayName: 'Lia',
    avatarColor: '#123456',
    avatarIcon: 'star',
  });
  const { result } = await renderHook(() => useUserProfileResolver());

  await expect(result.current('friend-1', undefined)).resolves.toEqual({
    id: 'friend-1',
    name: 'Lia',
    avatarColor: '#123456',
    avatarIcon: 'star',
    isCurrentUser: false,
  });
  expect(friendshipApiService.getUserDetails).not.toHaveBeenCalled();
});

it('uses the local username for the offline current user without a server', async () => {
  const { result } = await renderHook(() => useUserProfileResolver());

  await expect(result.current('local-user', undefined)).resolves.toEqual({
    id: 'local-user',
    name: 'Caio',
    isCurrentUser: true,
  });
});

it('caches remote profiles by server and drops that cache after friendship changes', async () => {
  (friendshipApiService.getUserDetails as jest.Mock).mockResolvedValue({
    id: 'friend-1',
    username: 'Lia',
    avatarColor: '#ab12cd',
    avatarIcon: 'heart',
  });
  const { result } = await renderHook(() => useUserProfileResolver());
  const server = { id: 'server-1', idUser: 'owner' } as never;

  await result.current('friend-1', server);
  await result.current('friend-1', server);
  expect(friendshipApiService.getUserDetails).toHaveBeenCalledTimes(1);

  entityEventEmitter.emit('friendship_changed');
  await result.current('friend-1', server);
  expect(friendshipApiService.getUserDetails).toHaveBeenCalledTimes(2);
});
