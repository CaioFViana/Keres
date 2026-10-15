import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { comments, tiers, users } from '@/db/schema';
import { tierEnforcementService } from '@/services/TierEnforcementService';
import {
  newId,
  registerUser,
  request,
  shareStory,
  type TestUser,
  uploadTestStory,
} from '@test/helpers/app';
import { truncateAll } from '@test/helpers/database';

/**
 * A comment is not an entity, so the entity ceilings never see it; `maxCommentsPerStory` is its own cap. These
 * drive it through sync, where a refusal is a `limit_exceeded` conflict, and through the plan routes.
 */

let ana: TestUser;
let storyId: string;
let characterId: string;

const push = (token: string, story: string, updates: unknown[]) =>
  request('POST', `/sync/${story}`, { token, body: updates });

const createCharacter = (id: string) => ({
  type: 'create' as const,
  entity: 'Character',
  id,
  version: 0,
  data: { id, storyId, name: 'Keres' },
  clientOperationId: `local-${id}`,
});

const commentCreate = (id: string, author: TestUser) => ({
  type: 'create' as const,
  entity: 'Comment',
  id,
  data: {
    entityType: 'Character',
    entityId: characterId,
    fieldId: null,
    fieldKey: 'name',
    contentSnapshot: 'Keres',
    excerptText: null,
    authorUserId: author.userId,
    commentText: 'Rever este nome',
    criticality: 1,
  },
});

/** Gives a user a plan with the given ceilings; the unnamed ones are unlimited. */
async function planFor(userId: string, limits: Record<string, number | null>) {
  const tierId = newId();
  await db.insert(tiers).values({
    id: tierId,
    name: `Tier ${tierId}`,
    isDefault: false,
    maxStories: null,
    maxEntitiesPerStory: null,
    maxEntitiesTotal: null,
    maxStorageBytesPerStory: null,
    maxStorageBytesTotal: null,
    maxCommentsPerStory: null,
    ...limits,
  } as never);
  await db.update(users).set({ tierId }).where(eq(users.id, userId));
}

async function liveComments(): Promise<number> {
  const rows = await db
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.storyId, storyId), eq(comments.isDeleted, false)));
  return rows.length;
}

/** Makes `collaborator` a writer of `story`, as the owner would invite them. */
async function grantWriter(owner: TestUser, collaborator: TestUser, story: string) {
  const requested = await request('POST', `/friend/request/${collaborator.userId}`, {
    token: owner.token,
  });
  expect(requested.status).toBeLessThan(400);
  const accepted = await request('PUT', `/friend/accept/${owner.userId}`, {
    token: collaborator.token,
  });
  expect(accepted.status).toBeLessThan(400);
  await shareStory(owner, collaborator, story, 'writer');
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token)).id;
  characterId = newId();
  await push(ana.token, storyId, [createCharacter(characterId)]);
});

describe('the comment cap on sync', () => {
  it('refuses the comment past the cap as limit_exceeded, and writes nothing', async () => {
    await planFor(ana.userId, { maxCommentsPerStory: 2 });
    await push(ana.token, storyId, [commentCreate(newId(), ana), commentCreate(newId(), ana)]);
    expect(await liveComments()).toBe(2);

    const { data } = await push(ana.token, storyId, [commentCreate(newId(), ana)]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toEqual([
      expect.objectContaining({
        entity: 'Comment',
        reason: 'limit_exceeded',
        message: 'Comment limit for this story reached for your plan (2).',
      }),
    ]);
    expect(await liveComments()).toBe(2);
  });

  it('holds a collaborator to the owner’s cap: the room is the story owner’s, whoever writes', async () => {
    await planFor(ana.userId, { maxCommentsPerStory: 1 });
    const bia = await registerUser('bia');
    await grantWriter(ana, bia, storyId);
    // The owner's own comment fills the only slot the owner's plan gives this story.
    await push(ana.token, storyId, [commentCreate(newId(), ana)]);

    const { data } = await push(bia.token, storyId, [commentCreate(newId(), bia)]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toEqual([
      expect.objectContaining({ entity: 'Comment', reason: 'limit_exceeded' }),
    ]);
    expect(await liveComments()).toBe(1);
  });

  it('frees the slot of a deleted comment', async () => {
    await planFor(ana.userId, { maxCommentsPerStory: 1 });
    const first = newId();
    const created = await push(ana.token, storyId, [commentCreate(first, ana)]);
    const version = created.data.applied[0].entityVersion;
    await push(ana.token, storyId, [{ type: 'delete', entity: 'Comment', id: first, version }]);

    const { data } = await push(ana.token, storyId, [commentCreate(newId(), ana)]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
    expect(await liveComments()).toBe(1);
  });

  it('holds the restore of a deleted comment to the cap, as it holds a create', async () => {
    await planFor(ana.userId, { maxCommentsPerStory: 1 });
    const first = newId();
    const created = await push(ana.token, storyId, [commentCreate(first, ana)]);
    const deleted = await push(ana.token, storyId, [
      {
        type: 'delete',
        entity: 'Comment',
        id: first,
        version: created.data.applied[0].entityVersion,
      },
    ]);
    await push(ana.token, storyId, [commentCreate(newId(), ana)]);

    const { data } = await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Comment',
        id: first,
        changes: { isDeleted: false, version: deleted.data.applied[0].entityVersion },
      },
    ]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toEqual([
      expect.objectContaining({ entity: 'Comment', reason: 'limit_exceeded' }),
    ]);
    expect(await liveComments()).toBe(1);
  });

  it('is unlimited when the cap is blank', async () => {
    await planFor(ana.userId, { maxCommentsPerStory: null });

    const { data } = await push(ana.token, storyId, [
      commentCreate(newId(), ana),
      commentCreate(newId(), ana),
      commentCreate(newId(), ana),
    ]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(3);
  });

  it('allows no comment at all when the cap is 0', async () => {
    await planFor(ana.userId, { maxCommentsPerStory: 0 });

    const { data } = await push(ana.token, storyId, [commentCreate(newId(), ana)]);

    expect(data.applied).toEqual([]);
    expect(data.conflicts).toEqual([
      expect.objectContaining({ entity: 'Comment', reason: 'limit_exceeded' }),
    ]);
  });

  it('is not held to the entity ceilings, which do not count comments at all', async () => {
    // Every entity is refused here (the story is at its ceiling of 1), but a comment is not an entity.
    await planFor(ana.userId, { maxEntitiesPerStory: 1 });

    const { data } = await push(ana.token, storyId, [commentCreate(newId(), ana)]);

    expect(data.conflicts).toEqual([]);
    expect(data.applied).toHaveLength(1);
  });
});

describe('the plan the story and the account are told of', () => {
  it('tells the story its cap and how many live comments it holds, deleted ones left out', async () => {
    await planFor(ana.userId, { maxCommentsPerStory: 5 });
    const first = newId();
    const created = await push(ana.token, storyId, [
      commentCreate(first, ana),
      commentCreate(newId(), ana),
    ]);
    expect(created.data.applied).toHaveLength(2);
    await push(ana.token, storyId, [
      {
        type: 'delete',
        entity: 'Comment',
        id: first,
        version: created.data.applied[0].entityVersion,
      },
    ]);

    const { status, data } = await request('GET', `/stories/${storyId}/plan`, {
      token: ana.token,
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({ maxCommentsPerStory: 5, commentsUsed: 1 });
  });

  it('tells the account its cap per story', async () => {
    await planFor(ana.userId, { maxCommentsPerStory: 7 });

    const { status, data } = await request('GET', '/user/plan', { token: ana.token });

    expect(status).toBe(200);
    expect(data).toMatchObject({ maxCommentsPerStory: 7 });
  });
});

describe('entities no plan counts', () => {
  it('refuses a counted entity at the ceiling, and never a free one', async () => {
    await planFor(ana.userId, { maxEntitiesPerStory: 0 });

    await expect(
      tierEnforcementService.assertCanCreateEntity(ana.userId, storyId, 'Character'),
    ).rejects.toThrow(/Entity limit for this story reached for your plan \(0\)/);
    // A media file, a part of a scene and a link are free: a full story still takes them.
    for (const free of ['Gallery', 'ScenePage', 'SceneMusic', 'Choice', 'CharacterRelation']) {
      await expect(
        tierEnforcementService.assertCanCreateEntity(ana.userId, storyId, free),
      ).resolves.toBeUndefined();
    }
  });
});
