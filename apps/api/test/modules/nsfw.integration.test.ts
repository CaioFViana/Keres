import { CURRENT_STORY_FORMAT_VERSION } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { stories, storyPublications, storyShowcaseEntries, users } from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import { showcaseSettings } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { promoteToAdmin, truncateAll } from '../helpers/database';
import { enterRequiredMode, leaveRequiredMode } from '../helpers/ageVerificationAccounts';

// Publishing a version writes the .zip through the local blob backend, which uses `Bun.write`.
installBunShim();

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let storyId: string;

async function befriend(a: TestUser, b: TestUser) {
  await request('POST', `/friend/request/${b.userId}`, { token: a.token });
  await request('PUT', `/friend/accept/${a.userId}`, { token: b.token });
}

/**
 * Grants or takes the +18 standing. A grant is what the verification service's approval leaves in the database: the
 * administrator cannot grant it (the admin route refuses), so the test writes the row the way the approval does. A
 * revocation goes through the admin route, which is the one revocation path.
 */
async function verify(userId: string, verified = true) {
  if (!verified) {
    const { status } = await request('PUT', `/admin/api/users/${userId}`, {
      token: admin.token,
      body: { isAdultVerified: false },
    });
    expect(status).toBe(200);
    return;
  }
  await db
    .update(users)
    .set({
      isAdultVerified: true,
      verifiedAt: new Date(),
      verificationMethod: 'manual-document-live-photo',
    })
    .where(eq(users.id, userId));
}

async function flagNsfw(id: string, value = true) {
  await db.update(stories).set({ isNsfw: value }).where(eq(stories.id, id));
}

async function livePermission(userId: string, story: string) {
  return db.query.storyPermissions.findFirst({
    where: (table, { and, eq: equals }) =>
      and(
        equals(table.storyId, story),
        equals(table.userId, userId),
        equals(table.isDeleted, false),
      ),
  });
}

const invite = (token: string, targetUserId: string, story: string) =>
  request('POST', '/friend/story-invitations/', {
    token,
    body: { storyId: story, targetUserId, permissionType: 'reader' },
  });

const push = (token: string, story: string, updates: unknown[]) =>
  request('POST', `/sync/${story}`, { token, body: updates });

async function setAllowNsfw(value = true) {
  const { status } = await request('PUT', '/admin/registration-settings', {
    token: admin.token,
    body: { allowNsfw: value },
  });
  expect(status).toBe(200);
}

/** The server refuses to publish out of sync, so the test needs the real counter. */
async function serverOperationVersion(story: string): Promise<number> {
  const row = await db.query.stories.findFirst({ where: eq(stories.id, story) });
  return row!.lastOperationVersion;
}

const publishStory = async (token: string, story: string) =>
  request('POST', `/stories/${story}/publications`, {
    token,
    body: { operationVersion: await serverOperationVersion(story), labelMode: 'both' },
  });

const report = (token: string | undefined, story: string, reason: unknown) =>
  request('POST', `/stories/${story}/report`, { token, body: { reason } });

async function enableShowcase() {
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: true })
    .onConflictDoUpdate({
      target: showcaseSettings.id,
      set: { isShowcaseEnabled: true },
    });
}

/** A published row without going through the packaging pipeline. */
async function seedPublication(ownerId: string, story: string) {
  await db.insert(storyShowcaseEntries).values({
    storyId: story,
    ownerUserId: ownerId,
    visibility: 'public',
  });
  await db.insert(storyPublications).values({
    id: ulid(),
    storyId: story,
    ownerUserId: ownerId,
    label: 'v1',
    operationVersion: 0,
    formatVersion: CURRENT_STORY_FORMAT_VERSION,
    byteSize: 10,
    mediaIncluded: 0,
    mediaTotal: 0,
    snapshot: {
      title: 'A Queda',
      description: null,
      genre: null,
      language: null,
      author: null,
      type: 'linear',
      theme: null,
    },
  });
}

const listShowcase = (token?: string) => request('GET', '/public/stories', { token });
const detailShowcase = (token: string | undefined, story: string) =>
  request('GET', `/public/stories/${story}`, { token });

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  // The adults-only area exists only where verification is required: the server is put in that mode after its
  // accounts are made (they are active, as they were before the mode existed).
  enterRequiredMode();
  await befriend(ana, bia);
  storyId = (await uploadTestStory(ana.token, 'A Queda')).id;
});

afterEach(() => {
  leaveRequiredMode();
});

describe('NSFW collaborator gating', () => {
  it('refuses to invite whoever is not age-verified to an NSFW story', async () => {
    await flagNsfw(storyId);

    expect((await invite(ana.token, bia.userId, storyId)).status).toBe(403);

    await verify(bia.userId);
    expect((await invite(ana.token, bia.userId, storyId)).status).toBe(200);
  });

  it('invites freely while the story is safe', async () => {
    expect((await invite(ana.token, bia.userId, storyId)).status).toBe(200);
  });

  it('drops the invitation when the story turns NSFW before acceptance', async () => {
    const { data } = await invite(ana.token, bia.userId, storyId);
    await flagNsfw(storyId);

    const accepted = await request('PUT', `/friend/story-invitations/${data.id}/accept`, {
      token: bia.token,
    });

    expect(accepted.status).toBe(403);
    expect(await livePermission(bia.userId, storyId)).toBeUndefined();
  });

  it('refuses a role change that would keep a non-verified user on an NSFW story', async () => {
    await verify(bia.userId);
    const { data } = await invite(ana.token, bia.userId, storyId);
    await request('PUT', `/friend/story-invitations/${data.id}/accept`, { token: bia.token });
    await verify(bia.userId, false);

    const changed = await request('POST', '/story-permissions/', {
      token: ana.token,
      body: { storyId, targetUserId: bia.userId, permissionType: 'writer' },
    });

    // The flag is still off here, so the change goes through...
    expect(changed.status).toBe(200);

    await flagNsfw(storyId);
    const changedAgain = await request('POST', '/story-permissions/', {
      token: ana.token,
      body: { storyId, targetUserId: bia.userId, permissionType: 'reader' },
    });
    // ...but once NSFW, even a role change for the non-verified user is refused.
    expect(changedAgain.status).toBe(403);
  });

  it('expels non-verified collaborators when sync turns the flag on, keeping the verified', async () => {
    const cid = await registerUser('cid');
    await befriend(ana, cid);
    await verify(bia.userId);
    // Flagging is a privilege: the server allows it and the owner is verified.
    await setAllowNsfw();
    await verify(ana.userId);
    for (const collaborator of [bia, cid]) {
      const { data } = await invite(ana.token, collaborator.userId, storyId);
      await request('PUT', `/friend/story-invitations/${data.id}/accept`, {
        token: collaborator.token,
      });
    }

    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    const pushed = await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Story',
        id: storyId,
        changes: { isNsfw: true, version: story!.version },
        clientOperationId: `local-${newId()}`,
      },
    ]);

    expect(pushed.status).toBe(200);
    expect(pushed.data.conflicts).toEqual([]);
    expect(await livePermission(bia.userId, storyId)).toBeDefined();
    expect(await livePermission(cid.userId, storyId)).toBeUndefined();
    const row = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    expect(row!.isNsfw).toBe(true);
  });

  it('removes the user from NSFW stories when verification is revoked or the account is deleted', async () => {
    await verify(bia.userId);
    const { data } = await invite(ana.token, bia.userId, storyId);
    await request('PUT', `/friend/story-invitations/${data.id}/accept`, { token: bia.token });
    await flagNsfw(storyId);

    await verify(bia.userId, false);
    expect(await livePermission(bia.userId, storyId)).toBeUndefined();

    // Reverified and back in, then banned: gone again.
    await verify(bia.userId);
    const second = await invite(ana.token, bia.userId, storyId);
    expect(second.status).toBe(200);
    await request('PUT', `/friend/story-invitations/${second.data.id}/accept`, {
      token: bia.token,
    });
    const deleted = await request('DELETE', `/admin/api/users/${bia.userId}`, {
      token: admin.token,
    });
    expect(deleted.status).toBe(200);
    expect(await livePermission(bia.userId, storyId)).toBeUndefined();
  });
});

describe('NSFW flag privilege', () => {
  const flagOn = async (token: string) => {
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    return push(token, storyId, [
      {
        type: 'update',
        entity: 'Story',
        id: storyId,
        changes: { isNsfw: true, version: story!.version },
        clientOperationId: `local-${newId()}`,
      },
    ]);
  };

  const conflictReasons = (pushed: { data: { conflicts: { reason: string }[] } }) =>
    pushed.data.conflicts.map((conflict) => conflict.reason);

  const flagIs = async () =>
    (await db.query.stories.findFirst({ where: eq(stories.id, storyId) }))!.isNsfw;

  it('refuses to turn the flag on via sync when the server disallows mature content', async () => {
    await verify(ana.userId);

    const pushed = await flagOn(ana.token);

    expect(pushed.status).toBe(200);
    expect(conflictReasons(pushed)).toEqual(['unauthorized']);
    expect(await flagIs()).toBe(false);
  });

  it('refuses to turn the flag on via sync when the owner is not verified', async () => {
    await setAllowNsfw();

    const pushed = await flagOn(ana.token);

    expect(pushed.status).toBe(200);
    expect(conflictReasons(pushed)).toEqual(['unauthorized']);
    expect(await flagIs()).toBe(false);
  });

  it('lets anyone turn the flag off', async () => {
    await flagNsfw(storyId);
    const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
    const pushed = await push(ana.token, storyId, [
      {
        type: 'update',
        entity: 'Story',
        id: storyId,
        changes: { isNsfw: false, version: story!.version },
        clientOperationId: `local-${newId()}`,
      },
    ]);

    expect(pushed.status).toBe(200);
    expect(pushed.data.conflicts).toEqual([]);
    expect(await flagIs()).toBe(false);
  });

  it('refuses to publish an NSFW story without allowance or verification', async () => {
    await enableShowcase();
    await flagNsfw(storyId);

    expect((await publishStory(ana.token, storyId)).status).toBe(403);

    await setAllowNsfw();
    expect((await publishStory(ana.token, storyId)).status).toBe(403);

    await verify(ana.userId);
    expect((await publishStory(ana.token, storyId)).status).toBe(200);
  });

  it('toggles the server allowance from the admin panel', async () => {
    await setAllowNsfw();

    const { status, data } = await request('GET', '/admin/registration-settings', {
      token: admin.token,
    });
    expect(status).toBe(200);
    expect(data.allowNsfw).toBe(true);

    await setAllowNsfw(false);
    const { data: back } = await request('GET', '/admin/registration-settings', {
      token: admin.token,
    });
    expect(back.allowNsfw).toBe(false);
  });
});

describe('POST /stories/:storyId/report', () => {
  it('sends the reason to the administrators with the story id attached by the server', async () => {
    const { status, data } = await report(bia.token, storyId, 'spam links everywhere');

    expect(status).toBe(201);
    expect(data).toEqual({ ok: true });

    const inbox = await request('GET', '/admin/api/messages', {
      token: admin.token,
      query: { source: 'report' },
    });
    expect(inbox.status).toBe(200);
    expect(inbox.data.items).toHaveLength(1);
    expect(inbox.data.items[0].body).toBe(
      `[REPORT type:other story:${storyId}] spam links everywhere`,
    );
  });

  it('refuses the owner, strangers without session and empty reasons', async () => {
    expect((await report(ana.token, storyId, 'x')).status).toBe(403);
    expect((await report(undefined, storyId, 'x')).status).toBe(401);
    expect((await report(bia.token, storyId, '   ')).status).toBe(400);
    expect((await report(bia.token, newId(), 'x')).status).toBe(404);
  });
});

describe('showcase NSFW gating and shadowban', () => {
  beforeEach(async () => {
    await enableShowcase();
  });

  it('hides NSFW stories from anonymous and unverified viewers, showing them to verified adults who chose it', async () => {
    await seedPublication(ana.userId, storyId);
    await flagNsfw(storyId);

    expect((await listShowcase()).data).toEqual([]);
    expect((await detailShowcase(undefined, storyId)).status).toBe(404);
    expect((await detailShowcase(bia.token, storyId)).status).toBe(404);

    // Verified, but the adults-only showcase is also the owner's own choice: until it is on, nothing changes.
    await verify(bia.userId);
    expect((await listShowcase(bia.token)).data).toEqual([]);
    expect((await detailShowcase(bia.token, storyId)).status).toBe(404);

    const chosen = await request('PUT', '/user/preferences', {
      token: bia.token,
      body: { showNsfw: true },
    });
    expect(chosen.status).toBe(200);
    const listed = await listShowcase(bia.token);
    expect(listed.data.map((card: { storyId: string }) => card.storyId)).toEqual([storyId]);
    expect((await detailShowcase(bia.token, storyId)).status).toBe(200);
  });

  it('keeps safe stories visible to everyone', async () => {
    await seedPublication(ana.userId, storyId);

    expect((await listShowcase()).data).toHaveLength(1);
    expect((await detailShowcase(undefined, storyId)).status).toBe(200);
  });

  it('shadowbans the publications of a deactivated account', async () => {
    await seedPublication(ana.userId, storyId);
    expect((await listShowcase()).data).toHaveLength(1);

    await request('DELETE', `/admin/api/users/${ana.userId}`, { token: admin.token });

    expect((await listShowcase()).data).toEqual([]);
    await verify(bia.userId);
    expect((await listShowcase(bia.token)).data).toEqual([]);
    expect((await detailShowcase(bia.token, storyId)).status).toBe(404);
  });
});

describe('admin story moderation', () => {
  it('lists by flag, toggles with expulsion, and removes collaborators', async () => {
    const { data } = await invite(ana.token, bia.userId, storyId);
    await request('PUT', `/friend/story-invitations/${data.id}/accept`, { token: bia.token });

    const listed = await request('GET', '/admin/api/stories', {
      token: admin.token,
      query: { nsfw: 'false' },
    });
    expect(listed.status).toBe(200);
    expect(listed.data.items.map((item: { id: string }) => item.id)).toContain(storyId);

    const toggled = await request('PATCH', `/admin/api/stories/${storyId}`, {
      token: admin.token,
      body: { isNsfw: true },
    });
    expect(toggled.status).toBe(200);
    expect(toggled.data.isNsfw).toBe(true);
    // bia was never verified: the toggle expelled them.
    expect(await livePermission(bia.userId, storyId)).toBeUndefined();

    // Reverified, back in, then removed by hand.
    await verify(bia.userId);
    const second = await invite(ana.token, bia.userId, storyId);
    await request('PUT', `/friend/story-invitations/${second.data.id}/accept`, {
      token: bia.token,
    });
    const collaborators = await request('GET', `/admin/api/stories/${storyId}/collaborators`, {
      token: admin.token,
    });
    expect(collaborators.status).toBe(200);
    expect(collaborators.data.map((c: { userId: string }) => c.userId)).toEqual([bia.userId]);

    const removed = await request(
      'DELETE',
      `/admin/api/stories/${storyId}/collaborators/${bia.userId}`,
      { token: admin.token },
    );
    expect(removed.status).toBe(200);
    expect(await livePermission(bia.userId, storyId)).toBeUndefined();

    const removedAgain = await request(
      'DELETE',
      `/admin/api/stories/${storyId}/collaborators/${bia.userId}`,
      { token: admin.token },
    );
    expect(removedAgain.status).toBe(404);

    const forbidden = await request('GET', '/admin/api/stories', { token: bia.token });
    expect(forbidden.status).toBe(403);
  });

  it('exposes verification in the user detail and list filter', async () => {
    await verify(bia.userId);

    const detail = await request('GET', `/admin/api/users/${bia.userId}`, { token: admin.token });
    expect(detail.data.isAdultVerified).toBe(true);

    const filtered = await request('GET', '/admin/api/users', {
      token: admin.token,
      query: { adultVerified: 'true' },
    });
    expect(filtered.data.items.map((item: { id: string }) => item.id)).toContain(bia.userId);
    expect(filtered.data.items.map((item: { id: string }) => item.id)).not.toContain(ana.userId);
  });
});
