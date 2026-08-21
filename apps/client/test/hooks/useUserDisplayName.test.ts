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
jest.mock('../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: jest.fn(),
}));
jest.mock('../../src/services/FriendshipApiService', () => ({
  __esModule: true,
  friendshipApiService: { getUserDetails: jest.fn() },
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useUserDisplayName } from '../../src/hooks/useUserDisplayName';
import { friendshipApiService } from '../../src/services/FriendshipApiService';
import { createStoryService } from '../../src/services/storymanagement/StoryService';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';

const storyService = { getStoryById: jest.fn() };
const db = {
  query: {
    servers: { findFirst: jest.fn() },
    friendships: { findFirst: jest.fn() },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue(db);
  (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({
    userId: 'installation-user',
    username: 'Caio',
    activeServer: undefined,
  });
  (createStoryService as jest.Mock).mockReturnValue(storyService);
  storyService.getStoryById.mockResolvedValue(undefined);
  db.query.servers.findFirst.mockResolvedValue(undefined);
  db.query.friendships.findFirst.mockResolvedValue(undefined);
  (friendshipApiService.getUserDetails as jest.Mock).mockResolvedValue(undefined);
});

it('identifies the local offline installation without querying server data', async () => {
  const { result } = await renderHook(() => useUserDisplayName('installation-user', 'story-1'));

  await waitFor(() => expect(result.current).toBe('Caio you_suffix'));

  expect(storyService.getStoryById).not.toHaveBeenCalled();
});

it('identifies the active server user before looking for a friendship', async () => {
  (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({
    userId: 'installation-user',
    username: 'Caio',
    activeServer: { idUser: 'server-user', userName: 'Caio remoto' },
  });
  const { result } = await renderHook(() => useUserDisplayName('server-user', undefined));

  await waitFor(() => expect(result.current).toBe('Caio remoto you_suffix'));

  expect(db.query.friendships.findFirst).not.toHaveBeenCalled();
});

it('uses the cached friendship name when the logged user belongs to the story server', async () => {
  storyService.getStoryById.mockResolvedValue({ serverId: 'server-1' });
  db.query.servers.findFirst.mockResolvedValue({
    id: 'server-1',
    idUser: 'owner',
    userName: 'Owner',
  });
  db.query.friendships.findFirst.mockResolvedValue({ friendUsername: 'Lia' });
  const { result } = await renderHook(() => useUserDisplayName('friend-1', 'story-1'));

  await waitFor(() => expect(result.current).toBe('Lia'));

  expect(db.query.friendships.findFirst).toHaveBeenCalled();
  expect(friendshipApiService.getUserDetails).not.toHaveBeenCalled();
});
