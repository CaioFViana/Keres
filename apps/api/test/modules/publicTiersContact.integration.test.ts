import { beforeEach, describe, expect, it } from 'vitest';
import { PublicTiersResponseSchema } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { messages, tiers } from '../../src/db/schema';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';

let admin: TestUser;

async function seedTier(input: {
  name: string;
  isPublicForSale?: boolean;
  sortOrder?: number;
  priceMonthlyCents?: number | null;
  priceYearlyCents?: number | null;
  isDefault?: boolean;
  maxStories?: number | null;
  maxPublicationsPerDay?: number | null;
  isDeleted?: boolean;
  playMonthlyProductId?: string | null;
  playYearlyProductId?: string | null;
}): Promise<string> {
  const id = newId();
  await db.insert(tiers).values({
    id,
    name: input.name,
    playMonthlyProductId: input.playMonthlyProductId ?? null,
    playYearlyProductId: input.playYearlyProductId ?? null,
    isDefault: input.isDefault ?? false,
    isPublicForSale: input.isPublicForSale ?? false,
    sortOrder: input.sortOrder ?? 0,
    priceMonthlyCents: input.priceMonthlyCents ?? null,
    priceYearlyCents: input.priceYearlyCents ?? null,
    maxStories: input.maxStories ?? null,
    maxEntitiesPerStory: null,
    maxEntitiesTotal: null,
    maxStorageBytesPerStory: null,
    maxStorageBytesTotal: null,
    maxPublicationsPerDay: input.maxPublicationsPerDay ?? null,
    isDeleted: input.isDeleted ?? false,
  });
  return id;
}

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
});

describe('GET /public/tiers', () => {
  it('answers an empty list in the default currency on a fresh server', async () => {
    const { status, data } = await request('GET', '/public/tiers');

    expect(status).toBe(200);
    expect(data).toEqual({ currency: 'BRL', tiers: [] });
    expect(PublicTiersResponseSchema.safeParse(data).success).toBe(true);
  });

  it('lists only tiers for sale, ordered by sort order then name', async () => {
    await seedTier({ name: 'Zebra', isPublicForSale: true, sortOrder: 2 });
    await seedTier({ name: 'Beta', isPublicForSale: true, sortOrder: 1 });
    await seedTier({ name: 'Alpha', isPublicForSale: true, sortOrder: 1 });
    await seedTier({ name: 'Hidden', isPublicForSale: false });
    await seedTier({ name: 'Gone', isPublicForSale: true, isDeleted: true });

    const { status, data } = await request('GET', '/public/tiers');

    expect(status).toBe(200);
    expect(data.tiers.map((tier: { name: string }) => tier.name)).toEqual([
      'Alpha',
      'Beta',
      'Zebra',
    ]);
    expect(PublicTiersResponseSchema.safeParse(data).success).toBe(true);
  });

  it('exposes prices and limits, including the free tier at zero', async () => {
    await seedTier({
      name: 'Free',
      isDefault: true,
      isPublicForSale: true,
      priceMonthlyCents: 0,
      priceYearlyCents: null,
      maxStories: 2,
      maxPublicationsPerDay: 0,
    });

    const { data } = await request('GET', '/public/tiers');

    expect(data.tiers).toHaveLength(1);
    expect(data.tiers[0]).toMatchObject({
      name: 'Free',
      isDefault: true,
      priceMonthlyCents: 0,
      priceYearlyCents: null,
      maxStories: 2,
      maxPublicationsPerDay: 0,
    });
    // Nothing the landing page must not see.
    expect(data.tiers[0].isPublicForSale).toBeUndefined();
    expect(data.tiers[0].sortOrder).toBeUndefined();
  });

  it('exposes the store products selling a tier: the app needs their ids to buy', async () => {
    await seedTier({
      name: 'Pro',
      isPublicForSale: true,
      priceMonthlyCents: 1990,
      playMonthlyProductId: 'plus_monthly',
    });

    const { data } = await request('GET', '/public/tiers');

    expect(data.tiers[0]).toMatchObject({
      playMonthlyProductId: 'plus_monthly',
      playYearlyProductId: null,
      webMonthlyEnabled: true,
      webYearlyEnabled: true,
    });
    expect(PublicTiersResponseSchema.safeParse(data).success).toBe(true);
  });

  it('exposes where a tier is sold on the web, for the app to offer', async () => {
    await seedTier({ name: 'Mobile', isPublicForSale: true, priceMonthlyCents: 990 });
    await db.update(tiers).set({ webMonthlyEnabled: false }).where(eq(tiers.name, 'Mobile'));

    const { data } = await request('GET', '/public/tiers');

    expect(data.tiers[0]).toMatchObject({ webMonthlyEnabled: false, webYearlyEnabled: true });
    expect(PublicTiersResponseSchema.safeParse(data).success).toBe(true);
  });

  it('reflects the currency the administrator configured', async () => {
    await request('PUT', '/admin/api/registration-settings', {
      token: admin.token,
      body: { currency: 'USD' },
    });

    const { data } = await request('GET', '/public/tiers');

    expect(data.currency).toBe('USD');
  });

  it('answers 304 to a matching If-None-Match', async () => {
    await seedTier({ name: 'Pro', isPublicForSale: true, priceMonthlyCents: 1990 });

    const first = await request('GET', '/public/tiers');
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();

    const second = await request('GET', '/public/tiers', {
      headers: { 'if-none-match': etag! },
    });
    expect(second.status).toBe(304);
  });

  it('busts the cache when a price changes', async () => {
    const id = await seedTier({ name: 'Pro', isPublicForSale: true, priceMonthlyCents: 1990 });
    const etag = (await request('GET', '/public/tiers')).headers.get('etag');

    await db.update(tiers).set({ priceMonthlyCents: 2990 }).where(eq(tiers.id, id));

    const { status } = await request('GET', '/public/tiers', {
      headers: { 'if-none-match': etag! },
    });
    expect(status).toBe(200);
  });
});

describe('POST /public/contact', () => {
  it('stores a visitor message for the administrators', async () => {
    const { status, data } = await request('POST', '/public/contact', {
      body: { subject: 'Plans', body: 'Do you offer yearly billing?', contactEmail: 'a@b.co' },
    });

    expect(status).toBe(201);
    const stored = await db.query.messages.findFirst({ where: eq(messages.id, data.id) });
    expect(stored).toMatchObject({
      channel: 'site',
      senderId: null,
      recipientId: null,
      subject: 'Plans',
      body: 'Do you offer yearly billing?',
      contactEmail: 'a@b.co',
      adminReadAt: null,
    });
  });

  it('answers 400 for an empty subject or a bad email', async () => {
    const empty = await request('POST', '/public/contact', {
      body: { subject: '  ', body: 'x', contactEmail: 'a@b.co' },
    });
    const badEmail = await request('POST', '/public/contact', {
      body: { subject: 'x', body: 'y', contactEmail: 'not-an-email' },
    });

    expect(empty.status).toBe(400);
    expect(badEmail.status).toBe(400);
  });

  it('answers while the showcase is disabled', async () => {
    // Fresh database: showcase settings default to disabled.
    const { status } = await request('POST', '/public/contact', {
      body: { subject: 'Hi', body: 'Hello', contactEmail: 'a@b.co' },
    });

    expect(status).toBe(201);
  });

  // Last: the limiter is per IP and the in-memory app shares one IP across tests, so this
  // deliberately exhausts the file's whole budget.
  it('rate-limits flooding with 429', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      const { status } = await request('POST', '/public/contact', {
        body: { subject: `Hi ${attempt}`, body: 'Hello', contactEmail: 'a@b.co' },
      });
      statuses.push(status);
    }

    expect(statuses).toContain(429);
  });
});
