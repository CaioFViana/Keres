import { addBillingMonths, addBillingPeriod } from '@keres/shared/utils/billingPeriod';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import {
  auditEvents,
  paymentEvents,
  paymentSubscriptions,
  registrationSettings,
  tiers,
  users,
} from '../../src/db/schema';
import { auditService } from '../../src/services/AuditService';
import { setPaymentPlugin } from '../../src/services/payments/PaymentPluginRegistry';
import { subscriptionService } from '../../src/services/payments/SubscriptionService';
import { tierEnforcementService } from '../../src/services/TierEnforcementService';
import { getApp, newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';
import {
  createFakePaymentPlugin,
  FAKE_SIGNATURE_HEADER,
  FAKE_VALID_SIGNATURE,
  webhookBody,
} from '../helpers/fakePaymentPlugin';

/**
 * A plan given by an administrator is a payment of zero: it extends a running period, switches plan with the
 * time left converted by value, never renews, and whatever is paid for afterwards starts from where it ends.
 */
const DAY = 24 * 60 * 60 * 1000;
const daysBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / DAY;

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let fake: ReturnType<typeof createFakePaymentPlugin>;
let plusId: string;
let maxId: string;
let freeId: string;

async function webhook(events: Record<string, unknown>[]) {
  const app = await getApp();
  const response = await app.handle(
    new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', [FAKE_SIGNATURE_HEADER]: FAKE_VALID_SIGNATURE },
      body: webhookBody(events),
    }),
  );
  return response.status;
}

const paid = (over: Record<string, unknown>) => ({
  type: 'payment.succeeded',
  eventId: `evt_${newId()}`,
  paidAt: new Date().toISOString(),
  amountCents: 2500,
  currency: 'BRL',
  ...over,
});

const subscriptionOf = async (user: TestUser) =>
  (
    await db.select().from(paymentSubscriptions).where(eq(paymentSubscriptions.userId, user.userId))
  )[0];

/** A subscription a provider charges, with `left` days to go. */
async function chargedBy(
  user: TestUser,
  tierId: string,
  left: number,
  over: Partial<typeof paymentSubscriptions.$inferInsert> = {},
) {
  await db.insert(paymentSubscriptions).values({
    userId: user.userId,
    tierId,
    interval: 'monthly',
    status: 'active',
    paidUntil: new Date(Date.now() + left * DAY),
    amountCents: 2500,
    currency: 'BRL',
    providerId: 'fakepay',
    providerReference: `sub_${user.username}`,
    ...over,
  });
}

const give = (
  user: TestUser,
  tierId: string,
  body: Record<string, unknown> = {},
  as: TestUser = admin,
) =>
  request('POST', `/admin/payments/users/${user.userId}/gift`, {
    token: as.token,
    body: { tierId, months: 1, ...body },
  });

beforeEach(async () => {
  await truncateAll();
  fake = createFakePaymentPlugin({ withCancel: true, withDueHook: true });
  setPaymentPlugin(fake.plugin);
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  plusId = newId();
  maxId = newId();
  freeId = newId();
  await db.insert(tiers).values([
    {
      id: plusId,
      name: 'Plus',
      maxStories: 10,
      priceMonthlyCents: 2500,
      priceYearlyCents: 25000,
      isPublicForSale: true,
    },
    {
      id: maxId,
      name: 'Max',
      maxStories: 100,
      priceMonthlyCents: 7000,
      priceYearlyCents: 70000,
      isPublicForSale: true,
    },
    { id: freeId, name: 'Free', maxStories: 2, isPublicForSale: false },
  ]);
  await db.update(registrationSettings).set({ defaultTierId: freeId });
});

afterEach(() => {
  setPaymentPlugin(null);
  vi.restoreAllMocks();
});

describe('giving a plan to somebody with none', () => {
  it('opens a period of the plan that does not renew, and grants it at once', async () => {
    const before = Date.now();

    const { status, data } = await give(ana, maxId);

    expect(status).toBe(201);
    const row = await subscriptionOf(ana);
    expect(row).toMatchObject({
      tierId: maxId,
      status: 'active',
      providerId: 'admin',
      providerReference: null,
      amountCents: 0,
      cancelAtPeriodEnd: true,
    });
    expect(
      Math.abs(row.paidUntil.getTime() - addBillingMonths(new Date(before), 1).getTime()),
    ).toBeLessThan(5000);
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(maxId);
    expect(data.subscription).toMatchObject({ providerId: 'admin', tierName: 'Max' });
  });

  it('is shown to the person as a gift: nothing to stop, and a reminder that paying again is up to them', async () => {
    await give(ana, maxId);

    const { data } = await request('GET', '/payments', { token: ana.token });

    expect(data.subscription).toMatchObject({
      tierName: 'Max',
      status: 'active',
      complimentary: true,
      autoRenews: false,
      canCancelHere: false,
      cancelAtPeriodEnd: true,
      amountCents: 0,
    });
  });

  it('is written in the ledger and the activity record, by the administrator, and is no income', async () => {
    await give(ana, maxId, { months: 3 });
    await auditService.recordNow({ category: 'system', action: 'system.flush' });

    const [line] = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.kind, 'gift_granted'));
    expect(line).toMatchObject({
      userId: ana.userId,
      tierName: 'Max',
      amountCents: 0,
      providerId: 'admin',
    });
    expect(line.detail).toBe('3 month(s) by root');
    const [record] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, 'payment.gift_granted'),
          eq(auditEvents.subjectUserId, ana.userId),
        ),
      );
    expect(record).toMatchObject({ category: 'payment', actorUserId: admin.userId });
    expect(record.meta).toMatchObject({ tier: 'Max', months: 3, canceledRenewal: false });

    const summary = await request('GET', '/admin/payments/summary', { token: admin.token });
    expect(summary.data).toMatchObject({
      subscriptions: { active: 1 },
      monthlyRecurringCents: 0,
      last30Days: { payments: 0, amountCents: 0 },
    });
  });

  it('works on a server with no payment plugin, which is where plans are otherwise only handed out by hand', async () => {
    setPaymentPlugin(null);

    expect((await give(ana, maxId)).status).toBe(201);

    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(maxId);
  });

  it('starts a new period from now for a subscription that lapsed or ended', async () => {
    // A late one of the same plan stays the provider's (it is still charged); one that ended becomes a gift.
    await chargedBy(ana, plusId, -10, { status: 'due' });
    await chargedBy(bia, plusId, -10, { status: 'canceled', cancelAtPeriodEnd: true });

    await give(ana, plusId);
    await give(bia, maxId);

    for (const [user, tierId] of [
      [ana, plusId],
      [bia, maxId],
    ] as const) {
      const row = await subscriptionOf(user);
      expect(row).toMatchObject({ status: 'active', tierId });
      expect(daysBetween(new Date(), row.paidUntil)).toBeGreaterThan(27);
      expect(daysBetween(new Date(), row.paidUntil)).toBeLessThan(32);
    }
    expect((await subscriptionOf(ana)).providerId).toBe('fakepay');
    expect((await subscriptionOf(bia)).providerId).toBe('admin');
  });
});

describe('giving the plan the person is already on', () => {
  it('extends a gift from where it ends, as a payment of zero', async () => {
    await give(ana, maxId);
    const first = (await subscriptionOf(ana)).paidUntil;

    await give(ana, maxId, { months: 2 });

    expect((await subscriptionOf(ana)).paidUntil.toISOString()).toBe(
      addBillingMonths(first, 2).toISOString(),
    );
  });

  it('extends a paid subscription without touching what the provider charges or how', async () => {
    await chargedBy(ana, plusId, 20);
    const before = await subscriptionOf(ana);

    await give(ana, plusId);

    const after = await subscriptionOf(ana);
    expect(after.paidUntil.toISOString()).toBe(addBillingMonths(before.paidUntil, 1).toISOString());
    expect(after).toMatchObject({
      providerId: 'fakepay',
      providerReference: 'sub_ana',
      amountCents: 2500,
      cancelAtPeriodEnd: false,
      tierId: plusId,
    });
    // The provider goes on charging, so no consent was needed and nothing was cancelled.
    expect(fake.cancelSubscription).not.toHaveBeenCalled();
  });

  it('lets what is paid afterwards start from where the gift ends', async () => {
    await give(ana, plusId);
    const giftEnd = (await subscriptionOf(ana)).paidUntil;
    const opened = await request('POST', '/payments/checkout', {
      token: ana.token,
      body: { tierId: plusId, interval: 'monthly', methodId: 'card' },
    });

    await webhook([paid({ checkoutId: opened.data.id, subscriptionReference: 'sub_ana' })]);

    const row = await subscriptionOf(ana);
    expect(row.paidUntil.toISOString()).toBe(addBillingPeriod(giftEnd, 'monthly').toISOString());
    // Now it is a paid subscription of the provider's, and renews.
    expect(row).toMatchObject({
      providerId: 'fakepay',
      providerReference: 'sub_ana',
      cancelAtPeriodEnd: false,
    });
  });
});

describe('giving another plan while time is left', () => {
  it('switches at once and converts the time left by value, as paying for the change does', async () => {
    await chargedBy(ana, plusId, 20, { cancelAtPeriodEnd: true });

    await give(ana, maxId);

    const row = await subscriptionOf(ana);
    expect(row).toMatchObject({ tierId: maxId, providerId: 'admin', amountCents: 0 });
    // 20 days of a R$ 25 plan are about 7 days of a R$ 70 one, and the month given comes after them.
    const extra = daysBetween(addBillingMonths(new Date(), 1), row.paidUntil);
    expect(extra).toBeGreaterThan(6);
    expect(extra).toBeLessThan(8);
    const [line] = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.kind, 'gift_granted'));
    expect(line.detail).toMatch(/1 month\(s\) by root; 20 day\(s\) of Plus became [67]/);
  });

  it('values gift time at the plan’s price when it is switched, so changing plans does not make it free time', async () => {
    await give(ana, plusId, { months: 12 });

    await give(ana, maxId);

    const row = await subscriptionOf(ana);
    // A year of the R$ 25 plan is nowhere near a year of the R$ 70 one.
    expect(daysBetween(new Date(), row.paidUntil)).toBeLessThan(200);
    expect(row.tierId).toBe(maxId);
  });

  it('carries the time over as it is for a plan that has no price to value it by', async () => {
    await chargedBy(ana, plusId, 20, { cancelAtPeriodEnd: true });

    await give(ana, freeId);

    const row = await subscriptionOf(ana);
    expect(daysBetween(new Date(), row.paidUntil)).toBeGreaterThan(48);
  });
});

describe('giving another plan to somebody a provider is still charging', () => {
  beforeEach(async () => {
    await chargedBy(ana, plusId, 20);
  });

  it('says it cannot be done silently, and changes nothing', async () => {
    const { status, data } = await give(ana, maxId);

    expect(status).toBe(409);
    expect(data.message).toMatch(/still being charged/);
    expect(await subscriptionOf(ana)).toMatchObject({ tierId: plusId, cancelAtPeriodEnd: false });
    expect(fake.cancelSubscription).not.toHaveBeenCalled();
  });

  it('wants the administrator’s word that the person agreed, before it cancels anything', async () => {
    const { status } = await give(ana, maxId, { cancelRenewal: true });

    expect(status).toBe(400);
    expect(fake.cancelSubscription).not.toHaveBeenCalled();
    expect(await subscriptionOf(ana)).toMatchObject({ tierId: plusId, cancelAtPeriodEnd: false });
  });

  it('cancels the renewal at the provider, then gives the plan, and records the consent', async () => {
    const { status } = await give(ana, maxId, { cancelRenewal: true, consent: true });
    await auditService.recordNow({ category: 'system', action: 'system.flush' });

    expect(status).toBe(201);
    expect(fake.cancelSubscription).toHaveBeenCalledWith('sub_ana');
    expect(await subscriptionOf(ana)).toMatchObject({
      tierId: maxId,
      providerId: 'admin',
      cancelAtPeriodEnd: true,
    });
    const [record] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'payment.gift_granted'));
    expect(record.meta).toMatchObject({
      canceledRenewal: true,
      consentConfirmed: true,
      changedFrom: 'Plus',
    });
  });

  it('changes nothing when the provider refuses to cancel', async () => {
    fake.cancelSubscription.mockRejectedValueOnce(new Error('the provider refused'));

    const { status } = await give(ana, maxId, { cancelRenewal: true, consent: true });

    expect(status).toBe(502);
    expect(await subscriptionOf(ana)).toMatchObject({
      tierId: plusId,
      providerId: 'fakepay',
      cancelAtPeriodEnd: false,
    });
    expect(await db.select().from(paymentEvents)).toHaveLength(0);
  });

  it('goes ahead on the administrator’s word when the plugin cannot cancel at the provider', async () => {
    setPaymentPlugin(createFakePaymentPlugin().plugin);

    const { status } = await give(ana, maxId, { cancelRenewal: true, consent: true });

    expect(status).toBe(201);
    expect((await subscriptionOf(ana)).tierId).toBe(maxId);
  });

  it('asks nothing when the person is on a provider’s subscription that is already not renewing', async () => {
    await db
      .update(paymentSubscriptions)
      .set({ cancelAtPeriodEnd: true })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    expect((await give(ana, maxId)).status).toBe(201);
    expect(fake.cancelSubscription).not.toHaveBeenCalled();
  });

  it('cancels a late subscription the same way, since the provider may still charge it', async () => {
    await db
      .update(paymentSubscriptions)
      .set({ status: 'due', paidUntil: new Date(Date.now() - DAY) })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    expect((await give(ana, maxId)).status).toBe(409);
    expect((await give(ana, maxId, { cancelRenewal: true, consent: true })).status).toBe(201);
    expect(fake.cancelSubscription).toHaveBeenCalledTimes(1);
  });
});

describe('when the gift ends', () => {
  it('ends without a word to the provider and without calling it late, and the person falls back to what they had', async () => {
    await db.update(users).set({ tierId: plusId }).where(eq(users.id, ana.userId));
    await give(ana, maxId);

    const result = await subscriptionService.markDue(new Date(Date.now() + 32 * DAY));

    expect(result).toEqual({ due: 0, ended: 1 });
    expect(await subscriptionOf(ana)).toMatchObject({ status: 'canceled' });
    expect(fake.onSubscriptionDue).not.toHaveBeenCalled();
    // And at the date itself, before the job runs.
    await db
      .update(paymentSubscriptions)
      .set({ status: 'active', paidUntil: new Date(Date.now() - 1000) })
      .where(eq(paymentSubscriptions.userId, ana.userId));
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(plusId);
  });
});

describe('who may give, and what', () => {
  it('is for administrators only', async () => {
    expect((await give(ana, maxId, {}, bia)).status).toBe(403);
    expect(
      (
        await request('POST', `/admin/payments/users/${ana.userId}/gift`, {
          body: { tierId: maxId, months: 1 },
        })
      ).status,
    ).toBe(401);
    expect(await subscriptionOf(ana)).toBeUndefined();
  });

  it.each([
    ['months below one', { months: 0 }],
    ['months above the most that can be given', { months: 25 }],
    ['months that are not whole', { months: 1.5 }],
  ])('refuses %s', async (_label, body) => {
    expect((await give(ana, maxId, body)).status).toBe(400);
    expect(await subscriptionOf(ana)).toBeUndefined();
  });

  it('refuses a person or a plan that does not exist, or that was deleted', async () => {
    expect(
      (
        await request('POST', '/admin/payments/users/nobody/gift', {
          token: admin.token,
          body: { tierId: maxId, months: 1 },
        })
      ).status,
    ).toBe(404);
    expect((await give(ana, 'no-such-plan')).status).toBe(404);
    await db.update(tiers).set({ isDeleted: true }).where(eq(tiers.id, maxId));
    expect((await give(ana, maxId)).status).toBe(404);
    await db.update(users).set({ isDeleted: true }).where(eq(users.id, bia.userId));
    expect((await give(bia, plusId)).status).toBe(404);
  });

  it('gives a plan that is not for sale, which is what a gift is often for', async () => {
    expect((await give(ana, freeId)).status).toBe(201);
    expect((await subscriptionOf(ana)).tierId).toBe(freeId);
  });
});

describe('what an administrator sees of a person’s subscription', () => {
  const look = (user: TestUser, as: TestUser = admin) =>
    request('GET', `/admin/payments/users/${user.userId}/subscription`, { token: as.token });

  it('is nothing for somebody who never had one, and is for administrators only', async () => {
    expect((await look(ana)).data).toEqual({ subscription: null, canCancelAtProvider: false });
    expect((await look(ana, bia)).status).toBe(403);
  });

  it('says whether the provider could be stopped from here: yes for one the plugin can cancel, no for a gift', async () => {
    await chargedBy(ana, plusId, 20);
    await give(bia, maxId);

    const charged = (await look(ana)).data;
    expect(charged.subscription).toMatchObject({ tierName: 'Plus', providerId: 'fakepay' });
    expect(charged.canCancelAtProvider).toBe(true);
    const gifted = (await look(bia)).data;
    expect(gifted.subscription).toMatchObject({ tierName: 'Max', providerId: 'admin' });
    expect(gifted.canCancelAtProvider).toBe(false);
  });
});
