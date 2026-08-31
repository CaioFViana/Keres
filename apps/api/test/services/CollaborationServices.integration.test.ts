import { beforeEach, describe, expect, it } from 'vitest';
import { FriendshipService } from '../../src/services/FriendshipService';
import { StoryPermissionService } from '../../src/services/StoryPermissionService';
import { registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let bia: TestUser;
let storyId: string;
let friendshipService: FriendshipService;
let permissionService: StoryPermissionService;

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser();
  bia = await registerUser();
  friendshipService = new FriendshipService();
  permissionService = new StoryPermissionService();
  await friendshipService.sendFriendRequest(ana.userId, bia.userId);
  await friendshipService.acceptFriendRequest(bia.userId, ana.userId);
  const created = await request('POST', '/stories/', {
    token: ana.token,
    body: { title: 'Shared story', type: 'linear' },
  });
  storyId = created.data.id;
});

describe('collaboration services', () => {
  it('removes a collaborator permission immediately when the friendship is removed', async () => {
    await permissionService.upsertStoryPermission(ana.userId, storyId, bia.userId, 'writer');
    expect(await permissionService.getUserPermissionForStory(bia.userId, storyId)).toMatchObject({ permissionType: 'writer' });

    await friendshipService.unfriendUser(bia.userId, ana.userId);

    expect(await permissionService.getUserPermissionForStory(bia.userId, storyId)).toBeUndefined();
    expect(await friendshipService.getFriendships(ana.userId)).toEqual([]);
    await expect(
      permissionService.upsertStoryPermission(ana.userId, storyId, bia.userId, 'reader'),
    ).rejects.toThrow('Permission can only be granted to friends.');
  });

  it('makes blacklisting idempotent and revokes collaboration when it replaces a friendship', async () => {
    await permissionService.upsertStoryPermission(ana.userId, storyId, bia.userId, 'reader');

    const first = await friendshipService.blacklistUser(ana.userId, bia.userId);
    const second = await friendshipService.blacklistUser(ana.userId, bia.userId);

    expect(second.id).toBe(first.id);
    expect(await permissionService.getUserPermissionForStory(bia.userId, storyId)).toBeUndefined();
    expect(await friendshipService.getFriendships(ana.userId)).toMatchObject([
      { id: first.id, status: 'blacklisted', blockedById: ana.userId },
    ]);
  });

  it('never leaves a permission behind when a grant races with unfriending', async () => {
    await Promise.allSettled([
      permissionService.upsertStoryPermission(ana.userId, storyId, bia.userId, 'writer'),
      friendshipService.unfriendUser(ana.userId, bia.userId),
    ]);

    expect(await permissionService.getUserPermissionForStory(bia.userId, storyId)).toBeUndefined();
    expect(await friendshipService.getFriendships(ana.userId)).toEqual([]);
  });
});
