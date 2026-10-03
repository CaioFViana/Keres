import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { registrationSettings, tiers, users } from '../../src/db/schema';
import { effectiveDefaultTierId } from '../../src/services/defaultTier';
import { registrationSettingsService } from '../../src/services/RegistrationSettingsService';
import { tierEnforcementService } from '../../src/services/TierEnforcementService';
import { getApp, newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';

/**
 * The default plan is one thing written in two places - the registration setting and the flag on the plan - and
 * the two must say the same. The plan's checkbox used to be the one an administrator ticked, and it did nothing:
 * the server applied only the setting, and went on treating people with no plan as unlimited.
 */
let admin: TestUser;
let freeId: string;
let otherId: string;

const flagsOf = async () =>
  Object.fromEntries(
    (await db.select().from(tiers)).map((row) => [row.name, row.isDefault]),
  ) as Record<string, boolean>;

const settingOf = async () => (await registrationSettingsService.getOrCreate()).defaultTierId;

const putTier = (id: string, body: Record<string, unknown>) =>
  request('PUT', `/admin/api/tiers/${id}`, { token: admin.token, body });

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  freeId = newId();
  otherId = newId();
  await db.insert(tiers).values([
    { id: freeId, name: 'Free', maxStories: 2 },
    { id: otherId, name: 'Other', maxStories: 5 },
  ]);
});

describe('a plan ticked as default and nothing set in registration', () => {
  beforeEach(async () => {
    await db.update(tiers).set({ isDefault: true }).where(eq(tiers.id, freeId));
    await db.update(registrationSettings).set({ defaultTierId: null });
  });

  it('is the default plan: what was ticked is what applies', async () => {
    expect(await effectiveDefaultTierId()).toBe(freeId);

    const nobody = await registerUser('ana');
    await db.update(users).set({ tierId: null }).where(eq(users.id, nobody.userId));
    expect((await tierEnforcementService.getEffectiveTier(nobody.userId))?.id).toBe(freeId);
  });

  it('is given to a new account, though the setting names nothing', async () => {
    const created = await registerUser('bia');

    const row = await db.query.users.findFirst({ where: eq(users.id, created.userId) });
    expect(row?.tierId).toBe(freeId);
  });

  it('is no longer reported as a server with no default plan', async () => {
    const summary = await request('GET', '/admin/api/payments/summary', { token: admin.token });

    expect(summary.data.noDefaultTier).toBe(false);
  });

  it('cannot be deleted, as the default plan', async () => {
    const { status, data } = await request('DELETE', `/admin/api/tiers/${freeId}`, {
      token: admin.token,
    });

    expect(status).toBe(409);
    expect(data.message).toMatch(/default/);
  });

  it('is the first one when several are ticked, and one that was deleted is not counted', async () => {
    await db.update(tiers).set({ isDefault: true, sortOrder: 5 }).where(eq(tiers.id, otherId));
    await db.update(tiers).set({ sortOrder: 9 }).where(eq(tiers.id, freeId));
    expect(await effectiveDefaultTierId()).toBe(otherId);

    await db.update(tiers).set({ isDeleted: true }).where(eq(tiers.id, otherId));
    expect(await effectiveDefaultTierId()).toBe(freeId);

    await db.update(tiers).set({ isDeleted: true }).where(eq(tiers.id, freeId));
    expect(await effectiveDefaultTierId()).toBeNull();
  });
});

describe('ticking default on a plan', () => {
  it('sets the registration setting, and clears the flag of the plan that was', async () => {
    await putTier(freeId, { isDefault: true });
    expect(await settingOf()).toBe(freeId);

    await putTier(otherId, { isDefault: true });

    expect(await settingOf()).toBe(otherId);
    expect(await flagsOf()).toEqual({ Free: false, Other: true });
  });

  it('does the same when the plan is created already ticked', async () => {
    await putTier(freeId, { isDefault: true });

    const { status, data } = await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: { name: 'Fresh', isDefault: true },
    });

    expect(status).toBe(201);
    expect(data.isDefault).toBe(true);
    expect(await settingOf()).toBe(data.id);
    expect(await flagsOf()).toEqual({ Free: false, Other: false, Fresh: true });
  });

  it('leaves the server with none when the default plan is unticked', async () => {
    await putTier(freeId, { isDefault: true });

    const { data } = await putTier(freeId, { isDefault: false });

    expect(data.isDefault).toBe(false);
    expect(await settingOf()).toBeNull();
    expect(await effectiveDefaultTierId()).toBeNull();
    const summary = await request('GET', '/admin/api/payments/summary', { token: admin.token });
    expect(summary.data).toMatchObject({ noDefaultTier: false });
  });

  it('does not touch the default when another plan is unticked, or a plan is edited without the flag', async () => {
    await putTier(freeId, { isDefault: true });

    await putTier(otherId, { isDefault: false });
    await putTier(freeId, { maxStories: 3 });

    expect(await settingOf()).toBe(freeId);
    expect(await flagsOf()).toEqual({ Free: true, Other: false });
  });
});

describe('choosing the default in registration', () => {
  it('writes the flag on the plan, and clears the one that had it', async () => {
    await db.update(tiers).set({ isDefault: true }).where(eq(tiers.id, freeId));

    await request('PUT', '/admin/api/registration-settings', {
      token: admin.token,
      body: { defaultTierId: otherId },
    });

    expect(await settingOf()).toBe(otherId);
    expect(await flagsOf()).toEqual({ Free: false, Other: true });
  });

  it('clears every flag when it names none', async () => {
    await registrationSettingsService.update({ defaultTierId: freeId });

    await registrationSettingsService.update({ defaultTierId: null });

    expect(await flagsOf()).toEqual({ Free: false, Other: false });
    expect(await effectiveDefaultTierId()).toBeNull();
  });

  it('leaves the flags alone when the update says nothing of the default plan', async () => {
    await registrationSettingsService.update({ defaultTierId: freeId });

    await registrationSettingsService.update({ maxUsers: 50 });

    expect(await flagsOf()).toEqual({ Free: true, Other: false });
  });

  it('wins over a flag somebody left on another plan', async () => {
    await db.update(tiers).set({ isDefault: true }).where(eq(tiers.id, otherId));
    await db.update(registrationSettings).set({ defaultTierId: freeId });

    expect(await effectiveDefaultTierId()).toBe(freeId);
  });
});

describe('with no default at all', () => {
  it('leaves people with no plan unlimited, which is the case the administrators are warned about', async () => {
    const ana = await registerUser('ana');
    await db.update(users).set({ tierId: null }).where(eq(users.id, ana.userId));

    expect(await effectiveDefaultTierId()).toBeNull();
    expect(await tierEnforcementService.getEffectiveTier(ana.userId)).toBeNull();
    // The app is still there to ask; nothing here needs it.
    expect(await getApp()).toBeTruthy();
  });
});

describe('a free plan with every ceiling at 0, made in the admin panel', () => {
  const zeros = {
    maxStories: 0,
    maxEntitiesPerStory: 0,
    maxEntitiesTotal: 0,
    maxStorageBytesPerStory: 0,
    maxStorageBytesTotal: 0,
    maxPublicationsPerDay: 0,
    maxMessagesPerDay: 0,
  };

  it('is accepted, and is kept as zero - not as the blank that means unlimited', async () => {
    const { status, data } = await request('POST', '/admin/api/tiers', {
      token: admin.token,
      body: { name: 'Nothing', isDefault: true, ...zeros },
    });

    expect(status).toBe(201);
    expect(data).toMatchObject(zeros);
    expect(await settingOf()).toBe(data.id);
  });

  it('can be reached by editing one ceiling at a time, and a negative one is still refused', async () => {
    const edit = (body: Record<string, unknown>) => putTier(freeId, body);

    expect((await edit({ maxStories: 0 })).data.maxStories).toBe(0);
    expect((await edit({ maxStorageBytesTotal: 0 })).data).toMatchObject({
      maxStories: 0,
      maxStorageBytesTotal: 0,
    });
    expect((await edit({ maxEntitiesTotal: -1 })).status).toBe(400);
  });
});
