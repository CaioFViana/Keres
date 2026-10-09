/**
 * @jest-environment node
 */
const mockGet = jest.fn();
const mockSetActiveServer = jest.fn();

jest.mock('../../src/services/AuthTokenManager', () => ({
  __esModule: true,
  authTokenManager: {},
}));
jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  createKeresAxiosInstance: () => ({
    setTokenProvider: jest.fn(),
    setActiveServer: (...args: unknown[]) => mockSetActiveServer(...args),
    get: (...args: unknown[]) => mockGet(...args),
  }),
}));

import { FriendshipApiService } from '../../src/services/FriendshipApiService';

const server = { id: 'server-1', url: 'https://keres.test' } as never;

describe('FriendshipApiService.getSharedStories', () => {
  it('asks the given server which stories the person works on with that friend', async () => {
    const stories = [{ storyId: 's1', title: 'Casa', ownedByMe: true, permissionType: 'writer' }];
    mockGet.mockResolvedValueOnce({ data: stories });

    await expect(new FriendshipApiService().getSharedStories(server, 'friend-1')).resolves.toEqual(
      stories,
    );

    expect(mockGet).toHaveBeenCalledWith('/friend/shared-stories/friend-1');
    expect(mockSetActiveServer).toHaveBeenCalledWith(server);
  });
});
