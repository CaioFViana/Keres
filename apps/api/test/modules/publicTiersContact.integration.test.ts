import { beforeEach, describe, expect, it } from 'vitest';
import { PublicTiersResponseSchema } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { contactMessages, tiers } from '../../src/db/schema';
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
}): Promise<string> {
  const id = newId();
  await db.insert(tiers).values({
    id,
    name: input.name,
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
    const stored = await db.query.contactMessages.findFirst({
      where: eq(contactMessages.id, data.id),
    });
    expect(stored).toMatchObject({
      subject: 'Plans',
      body: 'Do you offer yearly billing?',
      contactEmail: 'a@b.co',
      isRead: false,
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

describe('admin contact messages', () => {
  // Straight into the table: the rate-limit test above already spent this file's POST budget.
  async function store(subject: string): Promise<string> {
    const id = newId();
    await db.insert(contactMessages).values({
      id,
      subject,
      body: 'Hello',
      contactEmail: 'a@b.co',
    });
    return id;
  }

  it('lists messages newest first', async () => {
    const firstId = newId();
    const secondId = newId();
    await db.insert(contactMessages).values({
      id: firstId,
      subject: 'First',
      body: 'one',
      contactEmail: 'a@b.co',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    });
    await db.insert(contactMessages).values({
      id: secondId,
      subject: 'Second',
      body: 'two',
      contactEmail: 'a@b.co',
      createdAt: new Date('2025-06-01T00:00:00Z'),
    });

    const { status, data } = await request('GET', '/admin/api/contact', { token: admin.token });

    expect(status).toBe(200);
    expect(data.map((row: { id: string }) => row.id)).toEqual([secondId, firstId]);
  });

  it('marks a message read when opened, and deletes it', async () => {
    const id = await store('Plans');

    const read = await request('GET', `/admin/api/contact/${id}`, { token: admin.token });
    expect(read.status).toBe(200);
    expect(read.data).toMatchObject({ id, subject: 'Plans', isRead: true });

    const deleted = await request('DELETE', `/admin/api/contact/${id}`, { token: admin.token });
    expect(deleted.status).toBe(200);

    const gone = await request('GET', `/admin/api/contact/${id}`, { token: admin.token });
    expect(gone.status).toBe(404);
  });

  it('answers 404 for a message that does not exist', async () => {
    const missing = newId();

    const read = await request('GET', `/admin/api/contact/${missing}`, { token: admin.token });
    const deleted = await request('DELETE', `/admin/api/contact/${missing}`, {
      token: admin.token,
    });

    expect(read.status).toBe(404);
    expect(deleted.status).toBe(404);
  });

  it('stays behind the admin gate', async () => {
    const anonymous = await request('GET', '/admin/api/contact');
    expect(anonymous.status).toBe(401);

    const comum = await registerUser('ana');
    const forbidden = await request('GET', '/admin/api/contact', { token: comum.token });
    expect(forbidden.status).toBe(403);
  });
});
