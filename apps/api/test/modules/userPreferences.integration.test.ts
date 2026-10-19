import { CURRENT_STORY_FORMAT_VERSION } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { showcaseSettings, stories, storyPublications, storyShowcaseEntries } from '@/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '@/db/schema/tables/showcaseSettings';
import { registerUser, request, type TestUser, uploadTestStory } from '@test/helpers/app';
import { installBunShim } from '@test/helpers/bunShim';
import { promoteToAdmin, truncateAll } from '@test/helpers/database';

// Publishing writes through the local blob backend, which uses `Bun.write`.
installBunShim();

/**
 * The owner's private `showNsfw` preference: it opens the adults-only part of the PUBLIC showcase to a verified
 * account that chose it, and nothing else. Verification is granted and taken back by the administrator, the way
 * the default (`manual`) mode does it.
 */

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let storyId: string;

const preferences = (token?: string) => request('GET', '/user/preferences', { token });

const setPreferences = (token: string | undefined, body: unknown) =>
  request('PUT', '/user/preferences', { token, body });

const adminSetVerified = (userId: string, verified: boolean) =>
  request('PUT', `/admin/api/users/${userId}`, {
    token: admin.token,
    body: { isAdultVerified: verified },
  });

async function befriend(a: TestUser, b: TestUser) {
  await request('POST', `/friend/request/${b.userId}`, { token: a.token });
  await request('PUT', `/friend/accept/${a.userId}`, { token: b.token });
}

async function flagNsfw(id: string, value = true) {
  await db.update(stories).set({ isNsfw: value }).where(eq(stories.id, id));
}

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
const listedIds = (listed: { data: { storyId: string }[] }) =>
  listed.data.map((card) => card.storyId);

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  storyId = (await uploadTestStory(ana.token, 'A Queda')).id;
});

describe('GET /user/preferences', () => {
  it('answers the owner with the default choice and no verification', async () => {
    const { status, data } = await preferences(ana.token);

    expect(status).toBe(200);
    expect(data).toEqual({ showNsfw: false, isAdultVerified: false });
  });

  it('requires a session', async () => {
    expect((await preferences()).status).toBe(401);
  });
});

describe('PUT /user/preferences', () => {
  it('refuses to turn the choice on for an account that is not age-verified', async () => {
    const { status, data } = await setPreferences(bia.token, { showNsfw: true });

    expect(status).toBe(403);
    expect(data.message).toBe('Only age-verified (+18) accounts can show adults-only content.');
    expect((await preferences(bia.token)).data.showNsfw).toBe(false);
  });

  it('lets an unverified account turn the choice off, which is a no-op', async () => {
    const { status, data } = await setPreferences(bia.token, { showNsfw: false });

    expect(status).toBe(200);
    expect(data).toEqual({ showNsfw: false, isAdultVerified: false });
  });

  it('turns the choice on and off for a verified account', async () => {
    await adminSetVerified(bia.userId, true);

    const on = await setPreferences(bia.token, { showNsfw: true });
    expect(on.status).toBe(200);
    expect(on.data).toEqual({ showNsfw: true, isAdultVerified: true });
    expect((await preferences(bia.token)).data).toEqual({ showNsfw: true, isAdultVerified: true });

    const off = await setPreferences(bia.token, { showNsfw: false });
    expect(off.status).toBe(200);
    expect(off.data).toEqual({ showNsfw: false, isAdultVerified: true });
  });

  it('accepts only the flag: a body cannot grant verification', async () => {
    const { status } = await setPreferences(bia.token, {
      showNsfw: true,
      isAdultVerified: true,
    });

    expect(status).toBe(403);
    const { data } = await request('GET', `/admin/api/users/${bia.userId}`, {
      token: admin.token,
    });
    expect(data.isAdultVerified).toBe(false);
  });

  it('requires a session', async () => {
    expect((await setPreferences(undefined, { showNsfw: false })).status).toBe(401);
  });
});

describe('the choice and the verification it depends on', () => {
  it('is reset to off when an administrator revokes the verification', async () => {
    await adminSetVerified(bia.userId, true);
    await setPreferences(bia.token, { showNsfw: true });

    expect((await adminSetVerified(bia.userId, false)).status).toBe(200);

    expect((await preferences(bia.token)).data).toEqual({
      showNsfw: false,
      isAdultVerified: false,
    });
    // Verified again later: the old choice does not come back by itself.
    await adminSetVerified(bia.userId, true);
    expect((await preferences(bia.token)).data).toEqual({ showNsfw: false, isAdultVerified: true });
  });

  it('is reported by /auth/me to the owner only', async () => {
    await adminSetVerified(bia.userId, true);
    await setPreferences(bia.token, { showNsfw: true });

    const own = await request('GET', '/auth/me', { token: bia.token });
    expect(own.data.showNsfw).toBe(true);
    expect(own.data.isAdultVerified).toBe(true);
  });

  it('is exported with the account data, and never leaks into public profile shapes', async () => {
    await adminSetVerified(bia.userId, true);
    await setPreferences(bia.token, { showNsfw: true });

    const exported = await request('GET', '/user/data', { token: bia.token });
    expect(exported.data.preferences).toEqual({ showNsfw: true });

    const details = await request('GET', `/user/details/${bia.userId}`, { token: ana.token });
    expect(details.status).toBe(200);
    expect(details.data).not.toHaveProperty('showNsfw');

    const byTag = await request('GET', '/user/by-tag/bia', { token: ana.token });
    expect(byTag.data).not.toHaveProperty('showNsfw');
  });
});

describe("showcase: adults-only stories need verification and the owner's choice", () => {
  beforeEach(async () => {
    await enableShowcase();
    await seedPublication(ana.userId, storyId);
    await flagNsfw(storyId);
  });

  it('hides them from anonymous and unverified viewers', async () => {
    expect(listedIds(await listShowcase())).toEqual([]);
    expect((await detailShowcase(undefined, storyId)).status).toBe(404);
    expect(listedIds(await listShowcase(bia.token))).toEqual([]);
    expect((await detailShowcase(bia.token, storyId)).status).toBe(404);
  });

  it('keeps them hidden from a verified adult who did not choose to see them', async () => {
    await adminSetVerified(bia.userId, true);

    expect(listedIds(await listShowcase(bia.token))).toEqual([]);
    expect((await detailShowcase(bia.token, storyId)).status).toBe(404);
  });

  it('shows them to a verified adult who chose to see them, and only to that account', async () => {
    await adminSetVerified(bia.userId, true);
    await setPreferences(bia.token, { showNsfw: true });

    expect(listedIds(await listShowcase(bia.token))).toEqual([storyId]);
    expect((await detailShowcase(bia.token, storyId)).status).toBe(200);
    expect(listedIds(await listShowcase())).toEqual([]);
    expect((await detailShowcase(undefined, storyId)).status).toBe(404);
  });

  it('hides them again the moment the verification is revoked', async () => {
    await adminSetVerified(bia.userId, true);
    await setPreferences(bia.token, { showNsfw: true });
    expect(listedIds(await listShowcase(bia.token))).toEqual([storyId]);

    await adminSetVerified(bia.userId, false);

    expect(listedIds(await listShowcase(bia.token))).toEqual([]);
    expect((await detailShowcase(bia.token, storyId)).status).toBe(404);
  });

  it('keeps safe stories visible to everyone, whatever the choice is', async () => {
    await db.update(stories).set({ isNsfw: false }).where(eq(stories.id, storyId));

    expect(listedIds(await listShowcase())).toEqual([storyId]);
    expect(listedIds(await listShowcase(bia.token))).toEqual([storyId]);
  });

  it('leaves collaboration on +18 stories depending on verification alone', async () => {
    await befriend(ana, bia);
    await adminSetVerified(bia.userId, true);
    // The owner's choice is off for bia: collaboration still accepts a verified account.
    expect((await preferences(bia.token)).data.showNsfw).toBe(false);

    const invited = await request('POST', '/friend/story-invitations/', {
      token: ana.token,
      body: { storyId, targetUserId: bia.userId, permissionType: 'reader' },
    });
    expect(invited.status).toBe(200);
  });
});
