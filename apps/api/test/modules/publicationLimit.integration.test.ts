import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  publicationLog,
  registrationSettings,
  showcaseSettings,
  tiers,
  users,
} from '../../src/db/schema';
import { SHOWCASE_SETTINGS_SINGLETON_ID } from '../../src/db/schema/tables/showcaseSettings';
import {
  TierLimitExceededError,
  tierEnforcementService,
} from '../../src/services/TierEnforcementService';
import { newId, registerUser, request, type TestUser, uploadTestStory } from '../helpers/app';
import { installBunShim } from '../helpers/bunShim';
import { promoteToAdmin, truncateAll } from '../helpers/database';

// Packaging a publication writes the .zip through the local blob backend, which uses `Bun.write`.
installBunShim();

let ana: TestUser;

async function seedTier(maxPublicationsPerDay: number | null, assignTo?: string) {
  const id = newId();
  await db.insert(tiers).values({
    id,
    name: `Tier ${id}`,
    isDefault: false,
    maxStories: null,
    maxEntitiesPerStory: null,
    maxEntitiesTotal: null,
    maxStorageBytesPerStory: null,
    maxStorageBytesTotal: null,
    maxPublicationsPerDay,
  } as never);
  if (assignTo) await db.update(users).set({ tierId: id }).where(eq(users.id, assignTo));
  return id;
}

async function publish(token: string, storyId: string) {
  const stored = await db.query.stories.findFirst({
    where: (stories, { eq: equals }) => equals(stories.id, storyId),
  });
  return request('POST', `/stories/${storyId}/publications`, {
    token,
    body: { operationVersion: stored!.lastOperationVersion, labelMode: 'date' },
  });
}

const logRows = (userId: string) =>
  db.select().from(publicationLog).where(eq(publicationLog.userId, userId));

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  await db
    .insert(showcaseSettings)
    .values({ id: SHOWCASE_SETTINGS_SINGLETON_ID, isShowcaseEnabled: true })
    .onConflictDoUpdate({ target: showcaseSettings.id, set: { isShowcaseEnabled: true } });
});

describe('publications per day (tier)', () => {
  it('lets a tier publish up to its number and refuses the next with a 429', async () => {
    await seedTier(2, ana.userId);
    const story = await uploadTestStory(ana.token);

    const first = await publish(ana.token, story.id);
    const second = await publish(ana.token, story.id);
    const third = await publish(ana.token, story.id);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.data.message).toMatch(/Publication limit reached for your plan \(2 per day\)/);
    // A refused publication is not counted, and wrote nothing.
    expect(await logRows(ana.userId)).toHaveLength(2);
  });

  it('is not reset by deleting versions: the cost was paid, so the count stays', async () => {
    await seedTier(1, ana.userId);
    const story = await uploadTestStory(ana.token);
    const first = await publish(ana.token, story.id);
    expect(first.status).toBe(200);

    const removed = await request('DELETE', `/stories/${story.id}/publications/${first.data.id}`, {
      token: ana.token,
    });
    const again = await publish(ana.token, story.id);

    expect(removed.status).toBe(200);
    expect(again.status).toBe(429);
  });

  it('counts per user: another account on the same tier has its own allowance', async () => {
    const bia = await registerUser('bia');
    const tierId = await seedTier(1, ana.userId);
    await db.update(users).set({ tierId }).where(eq(users.id, bia.userId));
    const anaStory = await uploadTestStory(ana.token);
    const biaStory = await uploadTestStory(bia.token);

    expect((await publish(ana.token, anaStory.id)).status).toBe(200);
    expect((await publish(ana.token, anaStory.id)).status).toBe(429);
    expect((await publish(bia.token, biaStory.id)).status).toBe(200);
  });

  it('does not limit a tier without the ceiling, nor a user without a tier', async () => {
    await seedTier(null, ana.userId);
    const story = await uploadTestStory(ana.token);
    for (let index = 0; index < 3; index += 1) {
      expect((await publish(ana.token, story.id)).status).toBe(200);
    }

    const cai = await registerUser('cai');
    const caiStory = await uploadTestStory(cai.token);
    expect((await publish(cai.token, caiStory.id)).status).toBe(200);
  });

  it('forbids publishing outright on a tier that says zero', async () => {
    await seedTier(0, ana.userId);
    const story = await uploadTestStory(ana.token);

    expect((await publish(ana.token, story.id)).status).toBe(429);
    expect(await logRows(ana.userId)).toHaveLength(0);
  });

  it('falls back to the default signup tier, like the other ceilings', async () => {
    const tierId = await seedTier(1);
    await db
      .insert(registrationSettings)
      .values({ id: 'singleton', defaultTierId: tierId } as never)
      .onConflictDoUpdate({ target: registrationSettings.id, set: { defaultTierId: tierId } });
    const story = await uploadTestStory(ana.token);

    expect((await publish(ana.token, story.id)).status).toBe(200);
    expect((await publish(ana.token, story.id)).status).toBe(429);
  });

  it('keeps a refused publication from costing anything: nothing is compiled or stored', async () => {
    await seedTier(0, ana.userId);
    const story = await uploadTestStory(ana.token);

    const refused = await request('POST', `/stories/${story.id}/publications`, {
      token: ana.token,
      body: {
        operationVersion: (await db.query.stories.findFirst({
          where: (stories, { eq: equals }) => equals(stories.id, story.id),
        }))!.lastOperationVersion,
        labelMode: 'date',
        manuscript: { format: 'pdf' },
        reader: {},
      },
    });

    expect(refused.status).toBe(429);
  });
});

describe('TierEnforcementService publication window', () => {
  const NOW = new Date('2026-09-29T12:00:00.000Z');
  const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);
  const logAt = (at: Date) =>
    db
      .insert(publicationLog)
      .values({ id: newId(), userId: ana.userId, storyId: newId(), createdAt: at });

  it('counts a rolling 24 hours, not a calendar day', async () => {
    await seedTier(2, ana.userId);
    await logAt(hoursAgo(23.9));
    await logAt(hoursAgo(1));

    await expect(tierEnforcementService.assertCanPublish(ana.userId, NOW)).rejects.toBeInstanceOf(
      TierLimitExceededError,
    );
    // An hour later the oldest one has left the window.
    await expect(
      tierEnforcementService.assertCanPublish(ana.userId, new Date(NOW.getTime() + 60 * 60 * 1000)),
    ).resolves.toBeUndefined();
  });

  it('does not count publications older than a day', async () => {
    await seedTier(1, ana.userId);
    await logAt(hoursAgo(24.5));
    await logAt(hoursAgo(40));

    await expect(tierEnforcementService.assertCanPublish(ana.userId, NOW)).resolves.toBeUndefined();
  });

  it('records a publication and drops entries older than two days', async () => {
    await logAt(hoursAgo(60));
    await logAt(hoursAgo(30));

    await tierEnforcementService.recordPublication(db, ana.userId, newId(), NOW);

    const remaining = (await logRows(ana.userId)).map((row) => row.createdAt.getTime()).sort();
    expect(remaining).toEqual([hoursAgo(30).getTime(), NOW.getTime()]);
  });
});

describe('the ceiling on the admin tiers routes', () => {
  it('is created, read back, updated to zero and cleared to unlimited', async () => {
    await promoteToAdmin(ana.userId);

    const created = await request('POST', '/admin/api/tiers', {
      token: ana.token,
      body: { name: 'Pro', maxPublicationsPerDay: 5 },
    });
    expect(created.status).toBe(201);
    expect(created.data.maxPublicationsPerDay).toBe(5);

    const zero = await request('PUT', `/admin/api/tiers/${created.data.id}`, {
      token: ana.token,
      body: { maxPublicationsPerDay: 0 },
    });
    expect(zero.data.maxPublicationsPerDay).toBe(0);

    const cleared = await request('PUT', `/admin/api/tiers/${created.data.id}`, {
      token: ana.token,
      body: { maxPublicationsPerDay: null },
    });
    expect(cleared.data.maxPublicationsPerDay).toBeNull();
  });

  it('is unlimited when a tier says nothing, and refuses a negative or fractional number', async () => {
    await promoteToAdmin(ana.userId);

    const plain = await request('POST', '/admin/api/tiers', {
      token: ana.token,
      body: { name: 'Plain' },
    });
    const negative = await request('POST', '/admin/api/tiers', {
      token: ana.token,
      body: { name: 'Negative', maxPublicationsPerDay: -1 },
    });
    const fractional = await request('POST', '/admin/api/tiers', {
      token: ana.token,
      body: { name: 'Fractional', maxPublicationsPerDay: 1.5 },
    });

    expect(plain.data.maxPublicationsPerDay).toBeNull();
    expect(negative.status).toBe(400);
    expect(fractional.status).toBe(400);
  });
});
