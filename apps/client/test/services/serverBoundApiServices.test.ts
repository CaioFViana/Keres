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
import { PublicationApiService } from '../../src/services/PublicationApiService';
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
    await storyPermissionApi.updateCollaboratorPermission(server, 'story', 'writer', 'reader');
    await storyPermissionApi.removeCollaborator(server, 'story', 'writer');

    expect(mockClient.post).toHaveBeenCalledWith('/story-permissions/', {
      storyId: 'story',
      targetUserId: 'writer',
      permissionType: 'reader',
    });
    expect(mockClient.delete).toHaveBeenCalledWith('/story-permissions/story/story/user/writer');
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

  it('maps every FriendshipApiService action to its endpoint and lists friendships', async () => {
    mockClient.put.mockResolvedValue({ data: { id: 'accepted' } });
    mockClient.delete.mockResolvedValue({ data: { id: 'gone' } });
    mockClient.post.mockResolvedValue({ data: { id: 'listed' } });
    mockClient.get.mockResolvedValue({ data: [{ id: 'friend-1' }] });
    const service = new FriendshipApiService();

    await expect(service.acceptFriendRequest(server, 'friend')).resolves.toEqual({
      id: 'accepted',
    });
    await expect(service.declineFriendRequest(server, 'friend')).resolves.toEqual({ id: 'gone' });
    await expect(service.unfriendUser(server, 'friend')).resolves.toEqual({ id: 'gone' });
    await expect(service.cancelSentFriendRequest(server, 'friend')).resolves.toEqual({
      id: 'gone',
    });
    await expect(service.blacklistUser(server, 'friend')).resolves.toEqual({ id: 'listed' });
    await expect(service.unblacklistUser(server, 'friend')).resolves.toEqual({ id: 'gone' });
    await expect(service.getFriendships(server)).resolves.toEqual([{ id: 'friend-1' }]);

    expect(mockClient.put).toHaveBeenCalledWith('/friend/accept/friend');
    expect(mockClient.delete).toHaveBeenCalledWith('/friend/decline/friend');
    expect(mockClient.delete).toHaveBeenCalledWith('/friend/unfriend/friend');
    expect(mockClient.delete).toHaveBeenCalledWith('/friend/request/friend');
    expect(mockClient.post).toHaveBeenCalledWith('/friend/blacklist/friend');
    expect(mockClient.delete).toHaveBeenCalledWith('/friend/blacklist/friend');
    expect(mockClient.get).toHaveBeenCalledWith('/friend/');
  });

  it('returns user details and rethrows a non-404 failure after logging it', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockClient.get
      .mockResolvedValueOnce({ data: { id: 'user', username: 'Ada' } })
      .mockRejectedValueOnce(new Error('boom'));
    const service = new FriendshipApiService();

    await expect(service.getUserDetails(server, 'user')).resolves.toEqual({
      id: 'user',
      username: 'Ada',
    });
    await expect(service.getUserDetails(server, 'user')).rejects.toThrow('boom');
    expect(console.error).toHaveBeenCalledWith('Error fetching user details:', expect.any(Error));
    (console.error as jest.Mock).mockRestore();
  });

  it('edits the tag and profile, changes the password and reads the own profile', async () => {
    mockClient.put.mockResolvedValue({ data: { id: 'me', tag: 'ada' } });
    mockClient.get.mockResolvedValue({ data: { id: 'me', username: 'Ada' } });
    const service = new UserApiService();

    await expect(service.updateOwnTag(server, 'ada')).resolves.toEqual({ id: 'me', tag: 'ada' });
    await expect(service.updateProfile(server, { displayName: 'Ada' } as never)).resolves.toEqual({
      id: 'me',
      tag: 'ada',
    });
    await expect(service.changeOwnPassword(server, 'old', 'new')).resolves.toBeUndefined();
    await expect(service.getOwnProfile(server)).resolves.toEqual({
      id: 'me',
      username: 'Ada',
    });

    expect(mockClient.put).toHaveBeenCalledWith('/user/tag', { tag: 'ada' });
    expect(mockClient.put).toHaveBeenCalledWith('/user/profile', { displayName: 'Ada' });
    expect(mockClient.put).toHaveBeenCalledWith('/user/password', {
      currentPassword: 'old',
      newPassword: 'new',
    });
    expect(mockClient.get).toHaveBeenCalledWith('/user/details/me');
  });

  it('rethrows a non-404 user lookup failure instead of reporting the user absent', async () => {
    mockClient.get.mockRejectedValueOnce(new Error('boom'));
    const service = new UserApiService();

    await expect(service.getUserByTag(server, 'ada')).rejects.toThrow('boom');
    mockClient.get.mockRejectedValueOnce(new Error('boom'));
    await expect(service.getOwnProfile(server)).rejects.toThrow('boom');
  });

  it('maps every PublicationApiService route to its endpoint', async () => {
    mockClient.get.mockResolvedValue({ data: [{ id: 'pub-1' }] });
    mockClient.post.mockResolvedValue({ data: { id: 'pub-2' } });
    mockClient.put.mockResolvedValue({});
    mockClient.delete.mockResolvedValue({});
    const service = new PublicationApiService();

    await expect(service.listVisible(server)).resolves.toEqual([{ id: 'pub-1' }]);
    await expect(service.getStoryShowcase(server, 'story')).resolves.toEqual([{ id: 'pub-1' }]);
    // Visibility travels with the publication so an earlier protection cannot linger silently.
    await expect(
      service.publish(server, 'story', 7, 'both', 'password', 'secret'),
    ).resolves.toEqual({ id: 'pub-2' });
    await service.setVisibility(server, 'story', 'public');
    await service.deletePublication(server, 'story', 'pub-1');
    await service.unpublish(server, 'story');

    expect(mockClient.get).toHaveBeenCalledWith('/stories/publications/mine');
    expect(mockClient.get).toHaveBeenCalledWith('/stories/story/publications');
    expect(mockClient.post).toHaveBeenCalledWith('/stories/story/publications', {
      operationVersion: 7,
      labelMode: 'both',
      visibility: 'password',
      password: 'secret',
    });

    // The manuscript travels as render options only: no bytes leave the device.
    const manuscript = {
      format: 'md',
      includeLooseScenes: false,
      routeId: 'route-1',
      labels: {
        goToPage: 'Go to page',
        goToScene: 'See',
        looseHeading: 'Loose scenes',
        tocHeading: 'Contents',
      },
    } as const;
    await service.publish(server, 'story', 7, 'both', 'public', undefined, manuscript);
    expect(mockClient.post).toHaveBeenCalledWith('/stories/story/publications', {
      operationVersion: 7,
      labelMode: 'both',
      visibility: 'public',
      password: undefined,
      manuscript,
    });
    expect(mockClient.put).toHaveBeenCalledWith('/stories/story/showcase', {
      visibility: 'public',
      password: undefined,
    });
    expect(mockClient.delete).toHaveBeenCalledWith('/stories/story/publications/pub-1');
    expect(mockClient.delete).toHaveBeenCalledWith('/stories/story/publications');
  });
});
