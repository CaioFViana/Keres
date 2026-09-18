import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { db } from '../../src/db';
import { friendships, stories, users } from '../../src/db/schema';
import { storyPermissionService } from '../../src/services/StoryPermissionService';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let anaId: string;
let biaId: string;

const seedUser = async (username: string) => {
  const id = newId();
  await db.insert(users).values({ id, username, tag: username, password: 'x' } as never);
  return id;
};

const seedStory = async (ownerId: string, overrides: Record<string, unknown> = {}) => {
  const id = newId();
  const now = new Date();
  await db.insert(stories).values({
    id,
    userId: ownerId,
    title: 'A Queda',
    type: 'linear',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    ...overrides,
  } as never);
  return id;
};

const befriend = async (a: string, b: string) => {
  await db
    .insert(friendships)
    .values({ senderId: a, receiverId: b, status: FriendStatus.FRIEND } as never);
};

beforeEach(async () => {
  await truncateAll();
  anaId = await seedUser('ana');
  biaId = await seedUser('bia');
  await befriend(anaId, biaId);
});

describe('StoryPermissionService gaps', () => {
  it('drops grants in both directions when two users part ways', async () => {
    const anaStory = await seedStory(anaId);
    const biaStory = await seedStory(biaId);
    await storyPermissionService.upsertStoryPermission(anaId, anaStory, biaId, 'reader');
    await storyPermissionService.upsertStoryPermission(biaId, biaStory, anaId, 'writer');

    await storyPermissionService.deletePermissionsBetweenUsers(anaId, biaId);

    expect(await db.query.storyPermissions.findMany()).toHaveLength(0);
  });

  it('refuses to revoke a grant on a story the caller does not own', async () => {
    const biaStory = await seedStory(biaId);
    await storyPermissionService.upsertStoryPermission(biaId, biaStory, anaId, 'reader');

    // Friends, but the story is not Ana's: the grant survives.
    await expect(
      storyPermissionService.deleteStoryPermission(anaId, biaStory, biaId),
    ).rejects.toThrow(/not found or not owned/i);
    expect(await db.query.storyPermissions.findMany()).toHaveLength(1);
  });

  it('lets a writer satisfy a reader requirement and rejects an unknown level', async () => {
    const anaStory = await seedStory(anaId);
    await storyPermissionService.upsertStoryPermission(anaId, anaStory, biaId, 'writer');

    expect(await storyPermissionService.hasPermission(biaId, anaStory, 'reader')).toBe(true);
    expect(await storyPermissionService.hasPermission(biaId, anaStory, 'admin' as never)).toBe(
      false,
    );
  });

  it('lists owned and shared stories, skipping deleted and revoked ones', async () => {
    const owned = await seedStory(anaId);
    await seedStory(anaId, { isDeleted: true });
    const sharedLive = await seedStory(biaId);
    const sharedRevoked = await seedStory(biaId);
    await storyPermissionService.upsertStoryPermission(biaId, sharedLive, anaId, 'reader');
    await storyPermissionService.upsertStoryPermission(biaId, sharedRevoked, anaId, 'reader');
    await storyPermissionService.deleteStoryPermission(biaId, sharedRevoked, anaId);

    expect((await storyPermissionService.getReadableStoryIds(anaId)).sort()).toEqual(
      [owned, sharedLive].sort(),
    );
    expect(await storyPermissionService.getReadableStoryIds('nobody')).toEqual([]);
  });

  it('treats a grant naming a user that does not exist as a grant to a non-friend', async () => {
    // The friendship check runs before the target lookup, and the friendships table references
    // users(id) on both engines, so a ghost target always fails as "not friends" (403) - the
    // service's 404 below it is only reachable by a deletion winning the race in between.
    const anaStory = await seedStory(anaId);

    const failure = await storyPermissionService
      .upsertStoryPermission(anaId, anaStory, newId(), 'reader')
      .then(
        () => null,
        (error: { status?: number; message?: string }) => error,
      );

    expect(failure?.status).toBe(403);
    expect(await db.query.storyPermissions.findMany()).toHaveLength(0);
  });

  it('removes a grant whose friendship broke between the check and the insert', async () => {
    // The unfriending this compensates for wins a race no sequential test can reproduce: real
    // rows would make the test flaky by construction. Forcing the two reads apart pins the
    // behavior that matters - the grant is rolled back instead of left usable.
    const anaStory = await seedStory(anaId);
    const areFriends = vi
      .spyOn(
        storyPermissionService as unknown as { _areFriends: () => Promise<boolean> },
        '_areFriends',
      )
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    try {
      await expect(
        storyPermissionService.upsertStoryPermission(anaId, anaStory, biaId, 'reader'),
      ).rejects.toThrow(/only be granted to friends/i);
      expect(await db.query.storyPermissions.findMany()).toHaveLength(0);
    } finally {
      areFriends.mockRestore();
    }
  });
});
