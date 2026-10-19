import { beforeEach, describe, expect, it } from 'vitest';
import { PublicTiersResponseSchema } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { registrationSettings, tiers } from '@/db/schema';
import { newId, registerUser, request, type TestUser } from '@test/helpers/app';
import { promoteToAdmin, truncateAll } from '@test/helpers/database';

/**
 * The server's setting for how the landing page presents its plans: `sale` (prices and buy links, as
 * always) or `info` (the same plans and limits, with no prices and nothing for sale).
 */

let admin: TestUser;
let proId: string;

beforeEach(async () => {
  await truncateAll();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  proId = newId();
  await db.insert(tiers).values({
    id: proId,
    name: 'Pro',
    isPublicForSale: true,
    sortOrder: 1,
    priceMonthlyCents: 1990,
    priceYearlyCents: 19900,
    playMonthlyProductId: 'keres_pro_monthly',
    playYearlyProductId: 'keres_pro_yearly',
    webMonthlyEnabled: true,
    webYearlyEnabled: true,
    maxStories: 10,
    maxPublicationsPerDay: 5,
    maxCommentsPerStory: 20,
    maxContributorsPerStory: 3,
  });
});

async function setDisplay(tiersDisplay: string) {
  return request('PUT', '/admin/api/registration-settings', {
    token: admin.token,
    body: { tiersDisplay },
  });
}

describe('GET /public/tiers with the sale display', () => {
  it('answers sale with the prices, store products and web flags', async () => {
    const { status, data } = await request('GET', '/public/tiers');

    expect(status).toBe(200);
    expect(PublicTiersResponseSchema.parse(data).display).toBe('sale');
    expect(data.display).toBe('sale');
    expect(data.tiers[0]).toMatchObject({
      name: 'Pro',
      priceMonthlyCents: 1990,
      priceYearlyCents: 19900,
      playMonthlyProductId: 'keres_pro_monthly',
      playYearlyProductId: 'keres_pro_yearly',
      webMonthlyEnabled: true,
      webYearlyEnabled: true,
    });
  });
});

describe('GET /public/tiers with the info display', () => {
  it('keeps the names and limits, and drops the prices, store products and web sale', async () => {
    await setDisplay('info');

    const { status, data } = await request('GET', '/public/tiers');

    expect(status).toBe(200);
    expect(PublicTiersResponseSchema.parse(data).display).toBe('info');
    expect(data.display).toBe('info');
    expect(data.tiers).toHaveLength(1);
    expect(data.tiers[0]).toMatchObject({
      id: proId,
      name: 'Pro',
      isDefault: false,
      priceMonthlyCents: null,
      priceYearlyCents: null,
      playMonthlyProductId: null,
      playYearlyProductId: null,
      webMonthlyEnabled: false,
      webYearlyEnabled: false,
      maxStories: 10,
      maxPublicationsPerDay: 5,
      maxCommentsPerStory: 20,
      maxContributorsPerStory: 3,
    });
  });

  it('still lists only the plans flagged public', async () => {
    await db.insert(tiers).values({ id: newId(), name: 'Secret', isPublicForSale: false });

    const { data } = await setDisplay('info').then(() => request('GET', '/public/tiers'));

    expect(data.tiers.map((tier: { name: string }) => tier.name)).toEqual(['Pro']);
  });

  it('changes the ETag, so a cached sale answer is not reused', async () => {
    const sale = (await request('GET', '/public/tiers')).headers.get('etag');
    await setDisplay('info');

    const info = await request('GET', '/public/tiers', { headers: { 'if-none-match': sale! } });

    expect(info.status).toBe(200);
    expect(info.headers.get('etag')).not.toBe(sale);
  });
});

describe('the admin setting for the display', () => {
  it('defaults to sale on a fresh server', async () => {
    const { status, data } = await request('GET', '/admin/api/registration-settings', {
      token: admin.token,
    });

    expect(status).toBe(200);
    expect(data.tiersDisplay).toBe('sale');
  });

  it('round-trips info through the PUT and the GET, and is stored', async () => {
    const put = await setDisplay('info');
    expect(put.status).toBe(200);
    expect(put.data.tiersDisplay).toBe('info');

    const get = await request('GET', '/admin/api/registration-settings', { token: admin.token });
    expect(get.data.tiersDisplay).toBe('info');

    const stored = await db.query.registrationSettings.findFirst({
      where: eq(registrationSettings.id, 'singleton'),
    });
    expect(stored?.tiersDisplay).toBe('info');
  });

  it('switches back to sale', async () => {
    await setDisplay('info');
    const back = await setDisplay('sale');

    expect(back.data.tiersDisplay).toBe('sale');
    const { data } = await request('GET', '/public/tiers');
    expect(data.tiers[0].priceMonthlyCents).toBe(1990);
  });

  it('refuses a value that is neither sale nor info, and keeps the stored one', async () => {
    await setDisplay('info');

    const { status } = await setDisplay('free');

    expect(status).toBe(400);
    const get = await request('GET', '/admin/api/registration-settings', { token: admin.token });
    expect(get.data.tiersDisplay).toBe('info');
  });
});
