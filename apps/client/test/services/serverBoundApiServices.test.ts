/**
 * @jest-environment node
 */
const mockClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  setTokenProvider: jest.fn(),
  setActiveServer: jest.fn(),
};
jest.mock('../../src/services/apiClient', () => ({ createKeresAxiosInstance: jest.fn() }));
jest.mock('../../src/services/AuthTokenManager', () => ({ authTokenManager: {} }));

import { FriendshipApiService } from '../../src/services/FriendshipApiService';
import { createKeresAxiosInstance } from '../../src/services/apiClient';
import { storyPermissionApi } from '../../src/services/StoryPermissionService';
import { UserApiService } from '../../src/services/UserApiService';

const server = { id: 'server', idUser: 'me', url: 'https://target.test' } as any;

beforeEach(() => {
  jest.clearAllMocks();
  (createKeresAxiosInstance as jest.Mock).mockReturnValue(mockClient);
});

describe('server-bound API services', () => {
  it('binds StoryPermissionService requests to the supplied server and sends collaborator data', async () => {
    mockClient.get.mockResolvedValue({ data: [{ id: 'permission' }] });
    mockClient.post.mockResolvedValue({});

    await expect(storyPermissionApi.getCollaborators(server, 'story')).resolves.toEqual([
      { id: 'permission' },
    ]);
    await storyPermissionApi.grantCollaborator(server, 'story', 'writer', 'writer');

    expect(createKeresAxiosInstance).toHaveBeenCalledWith({ baseURL: server.url });
    expect(mockClient.setTokenProvider).toHaveBeenCalled();
    expect(mockClient.setActiveServer).toHaveBeenCalledWith(server);
    expect(mockClient.get).toHaveBeenCalledWith('/story-permissions/story/story');
    expect(mockClient.post).toHaveBeenCalledWith('/story-permissions/', {
      storyId: 'story',
      targetUserId: 'writer',
      permissionType: 'writer',
    });
  });

  it('maps FriendshipApiService endpoints and treats a missing user detail as absent', async () => {
    mockClient.post.mockResolvedValue({ data: { id: 'friendship' } });
    mockClient.get.mockRejectedValue({ response: { status: 404 } });
    const service = new FriendshipApiService();

    await expect(service.sendFriendRequest(server, 'friend')).resolves.toEqual({
      id: 'friendship',
    });
    await expect(service.getUserDetails(server, 'missing')).resolves.toBeUndefined();
    expect(mockClient.post).toHaveBeenCalledWith('/friend/request/friend');
    expect(mockClient.get).toHaveBeenCalledWith('/user/details/missing');
  });

  it('encodes UserApiService tags and exposes a missing profile as undefined', async () => {
    mockClient.get
      .mockResolvedValueOnce({ data: { id: 'user', username: 'Ada' } })
      .mockRejectedValueOnce({ response: { status: 404 } });
    const service = new UserApiService();

    await expect(service.getUserByTag(server, 'ada/lovelace')).resolves.toEqual({
      id: 'user',
      username: 'Ada',
    });
    await expect(service.getOwnProfile(server)).resolves.toBeUndefined();
    expect(mockClient.get).toHaveBeenNthCalledWith(1, '/user/by-tag/ada%2Flovelace');
    expect(mockClient.get).toHaveBeenNthCalledWith(2, '/user/details/me');
  });

  it('regenerates recovery codes with the current password and returns the fresh batch', async () => {
    mockClient.put.mockResolvedValue({ data: { recoveryCodes: ['AAAAA-11111', 'BBBBB-22222'] } });
    const service = new UserApiService();

    await expect(service.regenerateRecoveryCodes(server, 'hunter2')).resolves.toEqual([
      'AAAAA-11111',
      'BBBBB-22222',
    ]);
    expect(mockClient.put).toHaveBeenCalledWith('/user/recovery-codes', {
      currentPassword: 'hunter2',
    });
  });
});
