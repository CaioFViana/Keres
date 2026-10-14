import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { tiers, users } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/**
 * `maxContributorsPerStory` caps the collaborators of a story (readers and writers alike, the owner not counted),
 * held against the owner's plan. A pending invitation takes a slot when it is sent; accepting one counts only the
 * live collaborators. A refusal is a 429 with the tier_limit code, and it keeps the invitation.
 */

const BASE = '/friend/story-invitations';

let ana: TestUser;
let storyId: string;
let tierId: string;

const invite = (token: string, targetUserId: string, permissionType = 'reader') =>
  request('POST', `${BASE}/`, {
    token,
    body: { storyId, targetUserId, permissionType },
  });

const accept = (token: string, invitationId: string) =>
  request('PUT', `${BASE}/${invitationId}/accept`, { token });

const mine = (token: string) => request('GET', `${BASE}/`, { token });

const previews = async (token: string) =>
  (await request('GET', '/sync/pullpreviews', { token })).data.storyPreviews;

async function befriend(a: TestUser, b: TestUser) {
  await request('POST', `/friend/request/${b.userId}`, { token: a.token });
  await request('PUT', `/friend/accept/${a.userId}`, { token: b.token });
}

/** A friend of the owner, who may be invited. */
async function friend(username: string): Promise<TestUser> {
  const user = await registerUser(username);
  await befriend(ana, user);
  return user;
}

/** Gives the owner a plan with this collaborator ceiling; `null` is unlimited. */
async function planWith(maxContributorsPerStory: number | null) {
  tierId = newId();
  await db.insert(tiers).values({
    id: tierId,
    name: `Tier ${tierId}`,
    isDefault: false,
    maxStories: null,
    maxEntitiesPerStory: null,
    maxEntitiesTotal: null,
    maxStorageBytesPerStory: null,
    maxStorageBytesTotal: null,
    maxContributorsPerStory,
  } as never);
  await db.update(users).set({ tierId }).where(eq(users.id, ana.userId));
}

async function setCap(maxContributorsPerStory: number | null) {
  await db.update(tiers).set({ maxContributorsPerStory }).where(eq(tiers.id, tierId));
}

/** Invites and accepts in one go: the friend becomes a live collaborator. */
async function collaborate(user: TestUser, permissionType = 'reader') {
  const { status, data } = await invite(ana.token, user.userId, permissionType);
  expect(status).toBe(200);
  const accepted = await accept(user.token, data.id);
  expect(accepted.status).toBe(200);
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  storyId = (await uploadTestStory(ana.token, 'A Queda')).id;
});

describe('the collaborator cap on invitations', () => {
  it('sends an invitation while the story is under the cap', async () => {
    await planWith(2);
    const bia = await friend('bia');

    const { status, data } = await invite(ana.token, bia.userId);

    expect(status).toBe(200);
    expect(data).toMatchObject({ storyId, inviteeId: bia.userId });
  });

  it('counts the live collaborators and the open invitations, and refuses the one past the cap as tier_limit', async () => {
    await planWith(2);
    const bia = await friend('bia');
    const carla = await friend('carla');
    const dani = await friend('dani');
    await collaborate(bia);
    // One live collaborator and this open invitation fill the two slots.
    expect((await invite(ana.token, carla.userId)).status).toBe(200);

    const refused = await invite(ana.token, dani.userId);

    expect(refused.status).toBe(429);
    expect(refused.data).toMatchObject({
      code: 'tier_limit',
      message: expect.stringMatching(
        /Collaborator limit for this story reached for your plan \(2\)/,
      ),
    });
    expect((await mine(dani.token)).data).toEqual([]);
  });

  it('does not count the owner against the cap', async () => {
    await planWith(1);
    const bia = await friend('bia');
    const carla = await friend('carla');

    expect((await invite(ana.token, bia.userId)).status).toBe(200);
    await accept(bia.token, (await mine(bia.token)).data[0].id);

    // The one slot is bia's: the owner never took it.
    expect((await invite(ana.token, carla.userId)).status).toBe(429);
  });

  it('counts readers and writers alike', async () => {
    await planWith(2);
    const bia = await friend('bia');
    const carla = await friend('carla');
    const dani = await friend('dani');
    await collaborate(bia, 'reader');
    await collaborate(carla, 'writer');

    const refused = await invite(ana.token, dani.userId, 'reader');

    expect(refused.status).toBe(429);
  });

  it('is unlimited when the cap is blank', async () => {
    await planWith(null);
    const bia = await friend('bia');
    const carla = await friend('carla');
    const dani = await friend('dani');

    await collaborate(bia);
    await collaborate(carla, 'writer');
    const { status } = await invite(ana.token, dani.userId);

    expect(status).toBe(200);
  });

  it('allows no collaborator at all when the cap is 0', async () => {
    await planWith(0);
    const bia = await friend('bia');

    const refused = await invite(ana.token, bia.userId);

    expect(refused.status).toBe(429);
    expect(refused.data).toMatchObject({
      code: 'tier_limit',
      message: 'Collaborator limit for this story reached for your plan (0).',
    });
    expect((await mine(bia.token)).data).toEqual([]);
  });

  it('does not count a re-invitation of somebody already invited, which only changes the role', async () => {
    await planWith(2);
    const bia = await friend('bia');
    const carla = await friend('carla');
    expect((await invite(ana.token, bia.userId, 'reader')).status).toBe(200);
    expect((await invite(ana.token, carla.userId, 'reader')).status).toBe(200);

    // The two slots are full, yet bia's invitation is only being changed to a writer's.
    const again = await invite(ana.token, bia.userId, 'writer');

    expect(again.status).toBe(200);
    const { data } = await mine(bia.token);
    expect(data).toEqual([
      expect.objectContaining({ inviteeId: bia.userId, permissionType: 'writer' }),
    ]);
  });

  it('lets an invitation be accepted when only itself is pending against a cap of one', async () => {
    await planWith(1);
    const bia = await friend('bia');
    const { data } = await invite(ana.token, bia.userId);

    const accepted = await accept(bia.token, data.id);

    expect(accepted.status).toBe(200);
  });

  it('refuses an acceptance past a cap lowered meanwhile, keeps the invitation, and grants it once the cap is raised', async () => {
    await planWith(2);
    const bia = await friend('bia');
    const carla = await friend('carla');
    const biaInvitation = await invite(ana.token, bia.userId);
    const carlaInvitation = await invite(ana.token, carla.userId);
    await setCap(1);

    expect((await accept(bia.token, biaInvitation.data.id)).status).toBe(200);
    const refused = await accept(carla.token, carlaInvitation.data.id);

    expect(refused.status).toBe(429);
    expect(refused.data).toMatchObject({ code: 'tier_limit' });
    expect((await mine(carla.token)).data).toEqual([
      expect.objectContaining({ id: carlaInvitation.data.id, inviteeId: carla.userId }),
    ]);
    expect(await previews(carla.token)).toEqual([]);

    await setCap(2);
    expect((await accept(carla.token, carlaInvitation.data.id)).status).toBe(200);
    expect(await previews(carla.token)).toEqual([
      expect.objectContaining({ storyId, role: 'reader' }),
    ]);
  });

  it('never removes the collaborators already on the story when the cap is lowered', async () => {
    await planWith(3);
    const bia = await friend('bia');
    const carla = await friend('carla');
    await collaborate(bia);
    await collaborate(carla);

    await setCap(0);

    expect(await previews(bia.token)).toEqual([expect.objectContaining({ storyId })]);
    expect(await previews(carla.token)).toEqual([expect.objectContaining({ storyId })]);
  });
});

describe('the plan the story and the account are told of', () => {
  it('tells the story its collaborator cap and how many live collaborators it has, open invitations left out', async () => {
    await planWith(5);
    const bia = await friend('bia');
    const carla = await friend('carla');
    await collaborate(bia);
    await invite(ana.token, carla.userId);

    const { status, data } = await request('GET', `/stories/${storyId}/plan`, {
      token: ana.token,
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({ maxContributorsPerStory: 5, contributorsUsed: 1 });
  });

  it('tells the account its collaborator cap per story', async () => {
    await planWith(7);

    const { status, data } = await request('GET', '/user/plan', { token: ana.token });

    expect(status).toBe(200);
    expect(data).toMatchObject({ maxContributorsPerStory: 7 });
  });
});
