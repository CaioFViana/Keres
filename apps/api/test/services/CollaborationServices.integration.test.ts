import { beforeEach, describe, expect, it } from 'vitest';
import { FriendshipService } from '../../src/services/FriendshipService';
import { StoryInvitationService } from '../../src/services/StoryInvitationService';
import { StoryPermissionService } from '../../src/services/StoryPermissionService';
import { registerUser, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let bia: TestUser;
let storyId: string;
let friendshipService: FriendshipService;
let permissionService: StoryPermissionService;
let invitationService: StoryInvitationService;

async function collaborate(permissionType: 'reader' | 'writer') {
  const invitation = await invitationService.invite(
    ana.userId,
    storyId,
    bia.userId,
    permissionType,
  );
  await invitationService.accept(bia.userId, invitation.id);
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser();
  bia = await registerUser();
  friendshipService = new FriendshipService();
  permissionService = new StoryPermissionService();
  invitationService = new StoryInvitationService();
  await friendshipService.sendFriendRequest(ana.userId, bia.userId);
  await friendshipService.acceptFriendRequest(bia.userId, ana.userId);
  storyId = (await uploadTestStory(ana.token, 'Shared story')).id;
});

describe('collaboration services', () => {
  it('removes a collaborator permission immediately when the friendship is removed', async () => {
    await collaborate('writer');
    expect(await permissionService.getUserPermissionForStory(bia.userId, storyId)).toMatchObject({
      permissionType: 'writer',
    });

    await friendshipService.unfriendUser(bia.userId, ana.userId);

    expect(await permissionService.getUserPermissionForStory(bia.userId, storyId)).toBeUndefined();
    expect(await friendshipService.getFriendships(ana.userId)).toEqual([]);
    await expect(
      invitationService.invite(ana.userId, storyId, bia.userId, 'reader'),
    ).rejects.toThrow('Only friends can be invited to a story.');
  });

  it('drops open invitations when the friendship ends', async () => {
    await invitationService.invite(ana.userId, storyId, bia.userId, 'reader');

    await friendshipService.unfriendUser(ana.userId, bia.userId);

    expect(await invitationService.listForUser(bia.userId)).toEqual([]);
  });

  it('makes blacklisting idempotent and revokes collaboration when it replaces a friendship', async () => {
    await collaborate('reader');

    const first = await friendshipService.blacklistUser(ana.userId, bia.userId);
    const second = await friendshipService.blacklistUser(ana.userId, bia.userId);

    expect(second.id).toBe(first.id);
    expect(await permissionService.getUserPermissionForStory(bia.userId, storyId)).toBeUndefined();
    expect(await friendshipService.getFriendships(ana.userId)).toMatchObject([
      { id: first.id, status: 'blacklisted', blockedById: ana.userId },
    ]);
  });

  it('never leaves a permission behind when an acceptance races with unfriending', async () => {
    const invitation = await invitationService.invite(ana.userId, storyId, bia.userId, 'writer');

    await Promise.allSettled([
      invitationService.accept(bia.userId, invitation.id),
      friendshipService.unfriendUser(ana.userId, bia.userId),
    ]);

    // Either side may lose (on SQLite the unfriending can fail busy behind the acceptance's
    // write lock); what must hold is that access only outlives the race with the friendship.
    const stillFriends = (await friendshipService.getFriendships(ana.userId)).length > 0;
    const permission = await permissionService.getUserPermissionForStory(bia.userId, storyId);
    if (stillFriends) {
      expect(permission).toMatchObject({ permissionType: 'writer' });
    } else {
      expect(permission).toBeUndefined();
    }
  });
});
