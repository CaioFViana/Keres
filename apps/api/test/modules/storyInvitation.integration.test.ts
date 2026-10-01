import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { stories } from '../../src/db/schema';
import { registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let ana: TestUser;
let bia: TestUser;
let storyId: string;

const BASE = '/friend/story-invitations';

const invite = (token: string, targetUserId: string, permissionType: string, story = storyId) =>
  request('POST', `${BASE}/`, { token, body: { storyId: story, targetUserId, permissionType } });

const mine = (token: string) => request('GET', `${BASE}/`, { token });

const accept = (token: string, invitationId: string) =>
  request('PUT', `${BASE}/${invitationId}/accept`, { token });

const close = (token: string, invitationId: string) =>
  request('DELETE', `${BASE}/${invitationId}`, { token });

const previews = async (token: string) =>
  (await request('GET', '/sync/pullpreviews', { token })).data.storyPreviews;

async function befriend(a: TestUser, b: TestUser) {
  await request('POST', `/friend/request/${b.userId}`, { token: a.token });
  await request('PUT', `/friend/accept/${a.userId}`, { token: b.token });
}

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  await befriend(ana, bia);
  storyId = (await uploadTestStory(ana.token, 'A Queda')).id;
});

describe('inviting a friend to a story', () => {
  it('offers the story without giving access to it', async () => {
    const { status, data } = await invite(ana.token, bia.userId, 'writer');

    expect(status).toBe(200);
    expect(data).toMatchObject({
      storyId,
      storyTitle: 'A Queda',
      inviterId: ana.userId,
      inviterUsername: 'ana',
      inviteeId: bia.userId,
      inviteeUsername: 'bia',
      permissionType: 'writer',
    });
    expect((await mine(bia.token)).data).toEqual([data]);
    expect((await mine(ana.token)).data).toEqual([data]);
    // Nothing reaches the invitee's devices until they accept.
    expect(await previews(bia.token)).toEqual([]);
    const exported = await request('GET', `/stories/${storyId}/export`, { token: bia.token });
    expect(exported.status).toBeGreaterThanOrEqual(400);
  });

  it('changes the offered role when inviting again', async () => {
    await invite(ana.token, bia.userId, 'reader');
    await invite(ana.token, bia.userId, 'writer');

    const { data } = await mine(bia.token);
    expect(data).toHaveLength(1);
    expect(data[0].permissionType).toBe('writer');
  });

  it('lists the open invitations of a story to its owner only', async () => {
    await invite(ana.token, bia.userId, 'reader');

    const owner = await request('GET', `${BASE}/story/${storyId}`, { token: ana.token });
    expect(owner.data).toEqual([expect.objectContaining({ inviteeId: bia.userId })]);
    const other = await request('GET', `${BASE}/story/${storyId}`, { token: bia.token });
    expect(other.status).toBe(403);
  });

  it('refuses whoever is not a friend, the owner and somebody who already collaborates', async () => {
    const estranha = await registerUser('estranha');
    expect((await invite(ana.token, estranha.userId, 'reader')).status).toBe(403);
    expect((await invite(ana.token, ana.userId, 'reader')).status).toBe(400);

    const { data } = await invite(ana.token, bia.userId, 'reader');
    await accept(bia.token, data.id);
    const again = await invite(ana.token, bia.userId, 'writer');
    expect(again.status).toBe(409);
  });

  it('refuses an invitation to a story the caller does not own', async () => {
    const carla = await registerUser('carla');
    await befriend(bia, carla);

    const { status } = await invite(bia.token, carla.userId, 'reader');

    expect(status).toBe(403);
  });

  it('rejects a role that does not exist and requires a session', async () => {
    expect((await invite(ana.token, bia.userId, 'dono')).status).toBe(422);
    const anonymous = await request('POST', `${BASE}/`, {
      body: { storyId, targetUserId: bia.userId, permissionType: 'reader' },
    });
    expect(anonymous.status).toBe(401);
  });
});

describe('answering an invitation', () => {
  it('grants the offered role on acceptance', async () => {
    const { data } = await invite(ana.token, bia.userId, 'reader');

    const accepted = await accept(bia.token, data.id);

    expect(accepted.status).toBe(200);
    expect(accepted.data).toEqual({ storyId });
    expect(await previews(bia.token)).toEqual([
      expect.objectContaining({ storyId, role: 'reader' }),
    ]);
    expect((await mine(bia.token)).data).toEqual([]);
    expect((await mine(ana.token)).data).toEqual([]);
  });

  it('lets the invitee decline and the owner withdraw', async () => {
    const first = await invite(ana.token, bia.userId, 'reader');
    expect((await close(bia.token, first.data.id)).status).toBe(200);
    expect((await mine(ana.token)).data).toEqual([]);

    const second = await invite(ana.token, bia.userId, 'reader');
    expect((await close(ana.token, second.data.id)).status).toBe(200);
    expect((await mine(bia.token)).data).toEqual([]);
    expect(await previews(bia.token)).toEqual([]);
  });

  it('lets only the invitee accept, and hides the invitation from everyone else', async () => {
    const { data } = await invite(ana.token, bia.userId, 'reader');
    const carla = await registerUser('carla');

    expect((await accept(ana.token, data.id)).status).toBe(403);
    expect((await accept(carla.token, data.id)).status).toBe(404);
    expect((await close(carla.token, data.id)).status).toBe(404);
    expect((await mine(carla.token)).data).toEqual([]);
  });

  it('drops the invitation of a story deleted meanwhile', async () => {
    const { data } = await invite(ana.token, bia.userId, 'reader');
    await db.update(stories).set({ isDeleted: true }).where(eq(stories.id, storyId));

    expect((await mine(bia.token)).data).toEqual([]);
    expect((await accept(bia.token, data.id)).status).toBe(410);
    expect(await previews(bia.token)).toEqual([]);
  });

  it('drops the invitation when the friendship ends first', async () => {
    const { data } = await invite(ana.token, bia.userId, 'writer');

    await request('DELETE', `/friend/unfriend/${ana.userId}`, { token: bia.token });

    expect((await mine(bia.token)).data).toEqual([]);
    expect((await accept(bia.token, data.id)).status).toBe(404);
  });
});
