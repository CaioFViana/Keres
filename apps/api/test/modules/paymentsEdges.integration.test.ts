import { PAYMENT_RENEWAL_GRACE_HOURS } from '@keres/shared/metadata/Payments';
import { addBillingPeriod } from '@keres/shared/utils/billingPeriod';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import {
  paymentCheckouts,
  paymentEvents,
  paymentSubscriptions,
  tiers,
  users,
} from '../../src/db/schema';
import { setPaymentConnector } from '../../src/services/payments/PaymentConnectorRegistry';
import { subscriptionService } from '../../src/services/payments/SubscriptionService';
import { tierEnforcementService } from '../../src/services/TierEnforcementService';
import { getApp, newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';
import { createFakePaymentConnector } from '../helpers/fakePaymentConnector';
import { postEvents } from '../helpers/paymentEvents';

/**
 * The corners of the payment services the main suite (payments.integration.test.ts) walks past: notices that
 * arrive twice or about nothing, subscriptions in a state that makes an action meaningless, plugins that
 * offer less than the whole contract, and the administrators' lists under each ordering.
 */
const DAY = 24 * 60 * 60 * 1000;
/** A moment after a month paid today has ended, with the margin renewing subscriptions get after it. */
const afterMargin = () =>
  new Date(Date.now() + 31 * DAY + (PAYMENT_RENEWAL_GRACE_HOURS + 1) * 60 * 60 * 1000);

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let cris: TestUser;
let fake: ReturnType<typeof createFakePaymentConnector>;
let proId: string;

/** The connector's events, delivered as it would deliver them. A signature given stands for one that is not its own. */
const webhook = (events: Record<string, unknown>[], signature?: string) =>
  postEvents(events, { forged: signature !== undefined });

const paid = (over: Record<string, unknown>) => ({
  type: 'payment.succeeded',
  eventId: `evt_${newId()}`,
  paidAt: new Date().toISOString(),
  amountCents: 1990,
  currency: 'BRL',
  ...over,
});

async function openCheckout(user: TestUser, interval = 'monthly') {
  const { status, data } = await request('POST', '/payments/checkout', {
    token: user.token,
    body: { tierId: proId, interval, methodId: 'card' },
  });
  expect(status).toBe(201);
  return data as { id: string };
}

async function subscribe(user: TestUser, reference = `sub_${user.username}`, interval = 'monthly') {
  const mine = await openCheckout(user, interval);
  await webhook([
    paid({
      checkoutId: mine.id,
      subscriptionReference: reference,
      amountCents: interval === 'yearly' ? 19900 : 1990,
    }),
  ]);
  return mine;
}

const subscriptionOf = async (user: TestUser) =>
  (
    await db.select().from(paymentSubscriptions).where(eq(paymentSubscriptions.userId, user.userId))
  )[0];

const names = (items: { user: { username: string } | null }[]) =>
  items.map((item) => item.user?.username ?? null);

beforeEach(async () => {
  await truncateAll();
  fake = createFakePaymentConnector({
    withCancel: true,
    withDueHook: true,
    withStatusPolling: true,
  });
  setPaymentConnector(fake.connector);
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  cris = await registerUser('cris');
  proId = newId();
  await db.insert(tiers).values({
    id: proId,
    name: 'Pro',
    maxStories: 50,
    priceMonthlyCents: 1990,
    priceYearlyCents: 19900,
    isPublicForSale: true,
  });
});

afterEach(() => {
  setPaymentConnector(null);
  vi.restoreAllMocks();
});

describe('notices about something that is not there to change', () => {
  it('keeps a notice for an unknown subscription in the ledger, and says it again as a duplicate', async () => {
    const notice = {
      type: 'payment.failed',
      eventId: 'evt_unknown',
      subscriptionReference: 'sub_nobody',
    };

    expect((await webhook([notice])).data).toEqual({ received: 1, applied: 0 });
    expect((await webhook([notice])).data).toEqual({ received: 1, applied: 0 });

    const rows = await db.select().from(paymentEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'payment_failed',
      userId: null,
      providerReference: 'sub_nobody',
    });
  });

  it('does nothing for a cancellation of a subscription it does not have', async () => {
    // The person has an attempt open, but there is no subscription of the provider's to cancel yet.
    await openCheckout(ana);

    const { data } = await webhook([
      { type: 'subscription.canceled', eventId: 'evt_c', subscriptionReference: 'sub_never_paid' },
    ]);

    expect(data).toEqual({ received: 1, applied: 0 });
    expect(await db.select().from(paymentSubscriptions)).toHaveLength(0);
  });

  it('does nothing for an expiry of an attempt it does not know', async () => {
    await subscribe(ana);

    const { data } = await webhook([
      { type: 'checkout.expired', eventId: 'evt_e', checkoutId: 'an-attempt-of-another-server' },
    ]);

    expect(data).toEqual({ received: 1, applied: 0 });
  });

  it('applies a cancellation once, and counts the second as a duplicate', async () => {
    await subscribe(ana);
    const cancel = {
      type: 'subscription.canceled',
      eventId: 'evt_once',
      subscriptionReference: 'sub_ana',
    };

    expect((await webhook([cancel])).data).toEqual({ received: 1, applied: 1 });
    expect((await webhook([cancel])).data).toEqual({ received: 1, applied: 0 });
  });

  it('ends at once a subscription the provider cancels while it is already due', async () => {
    await subscribe(ana);
    await subscriptionService.markDue(afterMargin());
    expect((await subscriptionOf(ana)).status).toBe('due');

    await webhook([
      { type: 'subscription.canceled', eventId: 'evt_d', subscriptionReference: 'sub_ana' },
    ]);

    expect(await subscriptionOf(ana)).toMatchObject({
      status: 'canceled',
      cancelAtPeriodEnd: true,
    });
  });

  it('counts a repeated expiry or failure of an attempt once, and leaves a finished attempt alone', async () => {
    const mine = await openCheckout(ana);
    const expiry = { type: 'checkout.expired', eventId: 'evt_exp', checkoutId: mine.id };
    const failure = { type: 'payment.failed', eventId: 'evt_fail', checkoutId: mine.id };

    expect((await webhook([expiry])).data.applied).toBe(1);
    expect((await webhook([expiry])).data.applied).toBe(0);
    // Already expired: a failure is noted but does not turn the attempt into something else.
    expect((await webhook([failure])).data.applied).toBe(1);
    expect((await webhook([failure])).data.applied).toBe(0);
    expect((await db.select().from(paymentCheckouts))[0].status).toBe('expired');
  });

  it('grants nothing twice when the same charge is announced again under a new id', async () => {
    const mine = await subscribe(ana);
    const before = await subscriptionOf(ana);

    const { data } = await webhook([
      paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' }),
    ]);

    expect(data).toEqual({ received: 1, applied: 0 });
    expect((await db.select().from(paymentCheckouts))[0].status).toBe('paid');
    expect((await subscriptionOf(ana)).paidUntil.getTime()).toBe(before.paidUntil.getTime());
    // It is on the ledger, as turned down, so an administrator can see it arrived - and it is no payment of the person's.
    const lines = await db.select().from(paymentEvents).where(eq(paymentEvents.userId, ana.userId));
    expect(lines.some((line) => line.detail?.startsWith('Refused:'))).toBe(true);
  });

  it('still takes a second real payment a month later, with a new id', async () => {
    await subscribe(ana);
    const before = await subscriptionOf(ana);
    await db
      .update(paymentSubscriptions)
      .set({ lastPaymentAt: new Date(Date.now() - 30 * DAY) })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    const { data } = await webhook([paid({ subscriptionReference: 'sub_ana' })]);

    expect(data).toEqual({ received: 1, applied: 1 });
    expect((await subscriptionOf(ana)).paidUntil.getTime()).toBeGreaterThan(
      before.paidUntil.getTime(),
    );
  });

  it('renews by the provider’s reference alone, with no attempt behind the payment', async () => {
    await subscribe(ana);
    const before = await subscriptionOf(ana);

    const { data } = await webhook([
      paid({ subscriptionReference: 'sub_ana', amountCents: 2490, currency: 'USD' }),
    ]);

    expect(data.applied).toBe(1);
    const after = await subscriptionOf(ana);
    expect(after).toMatchObject({ amountCents: 2490, currency: 'USD', tierId: proId });
    expect(after.paidUntil.getTime()).toBeGreaterThan(before.paidUntil.getTime());
  });

  it('does not take a payment for the attempt of somebody who has no plan and no attempt to name', async () => {
    // A payment by reference for a subscription the server does not have: unmatched, ledger only.
    const { data } = await webhook([paid({ subscriptionReference: 'sub_ghost' })]);

    expect(data).toEqual({ received: 1, applied: 0 });
    expect(await db.select().from(paymentSubscriptions)).toHaveLength(0);
  });
});

describe('cancelling when it cannot go as usual', () => {
  it('has nothing to cancel with no plugin', async () => {
    await subscribe(ana);
    setPaymentConnector(null);

    expect(
      (await request('POST', '/payments/subscription/cancel', { token: ana.token })).status,
    ).toBe(404);
  });

  it('has nothing to cancel once the subscription is due', async () => {
    await subscribe(ana);
    await subscriptionService.markDue(afterMargin());

    expect(
      (await request('POST', '/payments/subscription/cancel', { token: ana.token })).status,
    ).toBe(404);
  });

  it('only flags it, without calling the provider, when the plugin cannot cancel', async () => {
    const limited = createFakePaymentConnector();
    setPaymentConnector(limited.connector);
    await subscribe(ana);

    const { status, data } = await request('POST', '/payments/subscription/cancel', {
      token: ana.token,
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({ cancelAtPeriodEnd: true, canCancelHere: false });
    expect(limited.cancelSubscription).not.toHaveBeenCalled();
  });

  it('does not ask a plugin to cancel what another provider charged', async () => {
    await subscribe(ana);
    await db
      .update(paymentSubscriptions)
      .set({ providerId: 'another' })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    const { status, data } = await request('POST', '/payments/subscription/cancel', {
      token: ana.token,
    });

    expect(status).toBe(200);
    expect(data.cancelAtPeriodEnd).toBe(true);
    expect(fake.cancelSubscription).not.toHaveBeenCalled();
  });
});

describe('changing plan while time is left', () => {
  let cheapId: string;
  let dearId: string;
  const DAYS = (n: number) => n * DAY;
  const daysBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / DAY;

  beforeEach(async () => {
    cheapId = newId();
    dearId = newId();
    await db.insert(tiers).values([
      {
        id: cheapId,
        name: 'Plus',
        priceMonthlyCents: 2500,
        priceYearlyCents: 25000,
        isPublicForSale: true,
      },
      {
        id: dearId,
        name: 'Max',
        priceMonthlyCents: 7000,
        priceYearlyCents: 70000,
        isPublicForSale: true,
      },
    ]);
  });

  /** A running subscription with `left` days to go on a plan, as a payment would have left it. */
  async function subscribedTo(
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
      paidUntil: new Date(Date.now() + DAYS(left)),
      amountCents: 2500,
      currency: 'BRL',
      providerId: 'fakepay',
      providerReference: `sub_${user.username}`,
      ...over,
    });
  }

  async function buyPlan(user: TestUser, tierId: string, interval = 'monthly') {
    const opened = await request('POST', '/payments/checkout', {
      token: user.token,
      body: { tierId, interval, methodId: 'card' },
    });
    expect(opened.status).toBe(201);
    const paidAt = new Date();
    await webhook([
      paid({
        checkoutId: opened.data.id,
        subscriptionReference: `sub_${user.username}`,
        paidAt: paidAt.toISOString(),
        amountCents: opened.data.amountCents,
      }),
    ]);
    return paidAt;
  }

  /** How many days past one bought period from `paidAt` the subscription now runs: what the time left became. */
  const extraDays = async (user: TestUser, paidAt: Date) =>
    daysBetween(addBillingPeriod(paidAt, 'monthly'), (await subscriptionOf(user)).paidUntil);

  it('converts twenty days of a R$ 25 plan into about seven days of a R$ 70 one, on top of what was bought', async () => {
    await subscribedTo(ana, cheapId, 20);

    const paidAt = await buyPlan(ana, dearId);

    expect((await subscriptionOf(ana)).tierId).toBe(dearId);
    // 20 days × 25/70 ≈ 7.1 - nowhere near the 20 a plain carry-over would have kept.
    const extra = await extraDays(ana, paidAt);
    expect(extra).toBeGreaterThan(6);
    expect(extra).toBeLessThan(8);
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(dearId);
  });

  it('converts into more days when the new plan is the cheaper one', async () => {
    await subscribedTo(ana, dearId, 20, { amountCents: 7000 });

    const paidAt = await buyPlan(ana, cheapId);

    const extra = await extraDays(ana, paidAt);
    expect(extra).toBeGreaterThan(20 * (70 / 25) - 3);
    expect(extra).toBeLessThan(20 * (70 / 25) + 3);
  });

  it('does not turn a year of a cheap plan into a year of an expensive one', async () => {
    await subscribedTo(ana, cheapId, 360, { interval: 'yearly', amountCents: 25000 });

    const paidAt = await buyPlan(ana, dearId);

    const total = daysBetween(paidAt, (await subscriptionOf(ana)).paidUntil);
    // About 107 days from the R$ 250 and a month from the R$ 70: not 360 + 30.
    expect(total).toBeLessThan(150);
    expect(total).toBeGreaterThan(120);
  });

  it('values time that was given at the plan’s price, not at the nothing it cost', async () => {
    await subscribedTo(ana, cheapId, 20, {
      amountCents: 0,
      providerId: 'admin',
      providerReference: null,
    });

    const paidAt = await buyPlan(ana, dearId);

    const extra = await extraDays(ana, paidAt);
    expect(extra).toBeGreaterThan(5);
    expect(extra).toBeLessThan(9);
  });

  it('converts nothing when the old plan has no price at all to value the time by', async () => {
    const odd = newId();
    await db.insert(tiers).values({ id: odd, name: 'Odd', isPublicForSale: false });
    await subscribedTo(ana, odd, 20, { amountCents: 0 });

    const paidAt = await buyPlan(ana, dearId);

    expect(Math.abs(await extraDays(ana, paidAt))).toBeLessThan(0.01);
  });

  it('keeps carrying the time over for the same plan, and starts from the payment for one that lapsed', async () => {
    await subscribedTo(ana, dearId, 20, { amountCents: 7000 });
    const same = await buyPlan(ana, dearId);
    expect(await extraDays(ana, same)).toBeGreaterThan(19.9);

    await subscribedTo(bia, cheapId, -5, { status: 'due' });
    const lapsed = await buyPlan(bia, dearId);
    expect(Math.abs(await extraDays(bia, lapsed))).toBeLessThan(0.01);
  });

  it('says what happened in the ledger, and applies it once however often the notice arrives', async () => {
    await subscribedTo(ana, cheapId, 20);
    const opened = await request('POST', '/payments/checkout', {
      token: ana.token,
      body: { tierId: dearId, interval: 'monthly', methodId: 'card' },
    });
    const notice = paid({
      checkoutId: opened.data.id,
      subscriptionReference: 'sub_ana',
      amountCents: 7000,
      eventId: 'evt_convert_once',
    });

    await webhook([notice]);
    const once = (await subscriptionOf(ana)).paidUntil.getTime();
    await webhook([notice]);

    expect((await subscriptionOf(ana)).paidUntil.getTime()).toBe(once);
    const [line] = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.kind, 'payment_succeeded'));
    expect(line.detail).toMatch(/Changed from Plus: 20 day\(s\) left became [67]\./);
  });

  describe('the quote, before paying', () => {
    const quote = (user: TestUser, tierId: string, interval = 'monthly') =>
      request('GET', '/payments/switch-quote', { token: user.token, query: { tierId, interval } });

    it('says what the days left would become, with the same numbers the payment will use', async () => {
      await subscribedTo(ana, cheapId, 20);

      const { status, data } = await quote(ana, dearId);

      expect(status).toBe(200);
      expect(data.quote).toEqual({
        fromTierName: 'Plus',
        toTierName: 'Max',
        remainingDays: 20,
        convertedDays: 7,
      });
    });

    it('has nothing to say for the same plan, for no subscription, for a lapsed one or for a plan not for sale', async () => {
      await subscribedTo(ana, cheapId, 20);
      expect((await quote(ana, cheapId)).data.quote).toBeNull();
      expect((await quote(bia, dearId)).data.quote).toBeNull();
      await db
        .update(paymentSubscriptions)
        .set({ status: 'due', paidUntil: new Date(Date.now() - DAY) })
        .where(eq(paymentSubscriptions.userId, ana.userId));
      expect((await quote(ana, dearId)).data.quote).toBeNull();
      await db
        .update(paymentSubscriptions)
        .set({ status: 'active', paidUntil: new Date(Date.now() + DAYS(20)) })
        .where(eq(paymentSubscriptions.userId, ana.userId));
      expect((await quote(ana, 'nope')).data.quote).toBeNull();
    });

    it('refuses what is not an interval, and needs a signed-in user', async () => {
      expect((await quote(ana, dearId, 'weekly')).status).toBe(400);
      expect((await request('GET', '/payments/switch-quote')).status).toBe(401);
    });
  });
});

describe('the demo provider, when it was not asked for', () => {
  it('is not there: /buy is a path nobody answers, and a real plugin may not send people to plain http', async () => {
    const app = await getApp();

    for (const route of ['/buy', '/buy/api/mine', '/buy/api/charge/x']) {
      const response = await app.handle(
        new Request(`http://localhost${route}`, { redirect: 'manual' }),
      );
      // Nobody answers it: an unknown path goes to the root where the client is built (302), and is a
      // plain 404 where it is not - CI never builds it. Either way, not the demo's page.
      expect([route, [302, 404].includes(response.status)]).toEqual([route, true]);
      if (response.status === 302) expect(response.headers.get('location')).toBe('/');
    }
    fake.connector.createCheckout = async () => ({
      providerReference: 'x',
      action: { kind: 'redirect', url: 'http://pay.example.test/x' },
    });
    const { status } = await request('POST', '/payments/checkout', {
      token: ana.token,
      body: { tierId: proId, interval: 'monthly', methodId: 'card' },
    });
    expect(status).toBe(502);
  });
});

describe('whether a subscription renews by itself', () => {
  const infoOf = async (user: TestUser) =>
    (await request('GET', '/payments', { token: user.token })).data.subscription;

  it('follows the method of the last payment: a plugin says which methods are charged again by the provider', async () => {
    const plugin = createFakePaymentConnector({
      withCancel: true,
      methods: [
        { id: 'card', label: 'Card' },
        { id: 'pix', label: 'PIX', recurring: false },
      ],
    });
    setPaymentConnector(plugin.connector);
    const withCard = await openCheckout(ana);
    await webhook([paid({ checkoutId: withCard.id, subscriptionReference: 'sub_ana' })]);
    const withPix = await request('POST', '/payments/checkout', {
      token: bia.token,
      body: { tierId: proId, interval: 'monthly', methodId: 'pix' },
    });
    await webhook([paid({ checkoutId: withPix.data.id, subscriptionReference: 'sub_bia' })]);

    expect((await infoOf(ana)).autoRenews).toBe(true);
    expect((await infoOf(bia)).autoRenews).toBe(false);
  });

  it('counts as renewing when the plugin does not say, or when nothing says how it was paid', async () => {
    // The fake plugin's methods carry no `recurring`: the answer before this existed.
    await subscribe(ana);
    expect((await infoOf(ana)).autoRenews).toBe(true);

    await db.insert(paymentSubscriptions).values({
      userId: bia.userId,
      tierId: proId,
      interval: 'monthly',
      status: 'active',
      paidUntil: new Date(Date.now() + 5 * DAY),
      amountCents: 1990,
      currency: 'BRL',
      providerId: 'fakepay',
    });
    expect((await infoOf(bia)).autoRenews).toBe(true);
  });

  it('is still answered when the plugin cannot list its methods', async () => {
    await subscribe(ana);
    fake.connector.listMethods = (() => Promise.reject(new Error('boom'))) as never;

    expect((await infoOf(ana)).autoRenews).toBe(true);
  });

  it('is part of the answer to cancelling, and is true with no plugin', async () => {
    await subscribe(ana);
    const { data } = await request('POST', '/payments/subscription/cancel', { token: ana.token });
    expect(data.autoRenews).toBe(true);

    setPaymentConnector(null);
    const row = await subscriptionOf(ana);
    expect(await subscriptionService.toWire(row, null)).toMatchObject({ autoRenews: true });
  });
});

describe('what the person sees of payments', () => {
  it('still answers when the plugin cannot list its ways to pay', async () => {
    fake.connector.listMethods = (() => Promise.reject(new Error('boom'))) as never;
    const { status, data } = await request('GET', '/payments', { token: ana.token });

    expect(status).toBe(200);
    expect(data).toMatchObject({ enabled: true, methods: [] });
  });

  it('shows a subscription that has not been paid yet with no date of payment', async () => {
    await db.insert(paymentSubscriptions).values({
      userId: ana.userId,
      tierId: proId,
      interval: 'monthly',
      status: 'active',
      paidUntil: new Date(Date.now() + 5 * DAY),
      amountCents: 1990,
      currency: 'BRL',
      providerId: 'fakepay',
    });

    const { data } = await request('GET', '/payments', { token: ana.token });

    expect(data.subscription).toMatchObject({ lastPaymentAt: null, canCancelHere: false });
  });
});

describe('when the paid period runs out, and the plugin does less', () => {
  it('marks it due without a word to a plugin that has no due hook', async () => {
    const quiet = createFakePaymentConnector({ withCancel: true });
    setPaymentConnector(quiet.connector);
    await subscribe(ana);

    expect(await subscriptionService.markDue(afterMargin())).toEqual({
      due: 1,
      ended: 0,
    });
    expect((await subscriptionOf(ana)).dueNotifiedAt).toBeNull();
  });

  it('does not tell a plugin about what another provider charged', async () => {
    await subscribe(ana);
    await db
      .update(paymentSubscriptions)
      .set({ providerId: 'another' })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    await subscriptionService.markDue(afterMargin());

    expect(fake.onSubscriptionDue).not.toHaveBeenCalled();
  });
});

describe('what the administrators see, ordered and searched', () => {
  async function seed() {
    await subscribe(ana, 'sub_ana');
    await subscribe(bia, 'sub_bia', 'yearly');
    await db
      .update(paymentSubscriptions)
      .set({ paidUntil: new Date(Date.now() + 3 * DAY) })
      .where(eq(paymentSubscriptions.userId, ana.userId));
  }

  const list = (query: Record<string, string>) =>
    request('GET', '/admin/api/payments/subscriptions', { token: admin.token, query });

  it('orders by the person or by when the subscription began, either way', async () => {
    await seed();

    expect(names((await list({ sort: 'user', order: 'asc' })).data.items)).toEqual(['ana', 'bia']);
    expect(names((await list({ sort: 'user', order: 'desc' })).data.items)).toEqual(['bia', 'ana']);
    const byDate = (await list({ sort: 'createdAt', order: 'asc' })).data.items;
    expect(names(byDate)).toEqual(['ana', 'bia']);
    expect(names((await list({ sort: 'createdAt', order: 'desc' })).data.items)).toEqual([
      'bia',
      'ana',
    ]);
    expect(names((await list({ sort: 'paidUntil', order: 'desc' })).data.items)).toEqual([
      'bia',
      'ana',
    ]);
  });

  it('finds a person by their name, whatever the case, and pages through the list', async () => {
    await seed();

    const byName = await list({ search: 'BIA' });
    expect(names(byName.data.items)).toEqual(['bia']);

    const page = await list({ pageSize: '1', page: '2', sort: 'user', order: 'asc' });
    expect(page.data).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(names(page.data.items)).toEqual(['bia']);
  });

  it('counts a yearly plan as a twelfth of its price a month, and nothing when there is none', async () => {
    const empty = await request('GET', '/admin/api/payments/summary', { token: admin.token });
    expect(empty.data).toMatchObject({
      subscriptions: { active: 0, due: 0, canceled: 0 },
      endingSoon: 0,
      last30Days: { payments: 0, failures: 0, amountCents: 0 },
      monthlyRecurringCents: 0,
    });

    await seed();
    const { data } = await request('GET', '/admin/api/payments/summary', { token: admin.token });
    expect(data.monthlyRecurringCents).toBe(1990 + Math.round(19900 / 12));
    expect(data.endingSoon).toBe(1);
  });

  it('lists a notice about nobody with no person, and a person since removed as removed', async () => {
    await webhook([paid({ subscriptionReference: 'sub_ghost' })]);
    await subscribe(cris, 'sub_cris');
    await db.update(users).set({ isDeleted: true }).where(eq(users.id, cris.userId));

    const { data } = await request('GET', '/admin/api/payments/events', { token: admin.token });

    const people = data.items.map(
      (item: { user: { username: string; isDeleted: boolean } | null }) => item.user,
    );
    expect(people).toContainEqual(null);
    expect(people.some((user: { isDeleted: boolean } | null) => user?.isDeleted === true)).toBe(
      true,
    );
  });

  it('filters the ledger by kind of event and by who or what it is about', async () => {
    await subscribe(ana, 'sub_ana');
    await subscribe(bia, 'sub_bia');
    await webhook([
      {
        type: 'payment.failed',
        eventId: `evt_${newId()}`,
        subscriptionReference: 'sub_bia',
        reason: 'Card declined',
      },
    ]);
    const list = async (query: Record<string, string>) =>
      (await request('GET', '/admin/api/payments/events', { token: admin.token, query })).data;

    const failures = await list({ kind: 'payment_failed' });
    expect(failures.total).toBe(1);
    expect(names(failures.items)).toEqual(['bia']);

    const received = await list({ kind: 'payment_succeeded' });
    expect(received.total).toBe(2);

    // By person (name or tag), by plan and by the provider's own reference, whatever the case.
    expect(names((await list({ search: 'ANA' })).items)).toEqual(['ana']);
    expect((await list({ search: 'sub_bia' })).total).toBe(2);
    expect((await list({ search: 'pro' })).total).toBeGreaterThanOrEqual(2);
    expect((await list({ search: 'nobody-has-this' })).total).toBe(0);

    // Both together, and the total follows the filter (not the whole ledger).
    const both = await list({ kind: 'payment_succeeded', search: 'bia' });
    expect(both.total).toBe(1);
    expect(names(both.items)).toEqual(['bia']);
  });

  it('refuses a kind of event that does not exist', async () => {
    const { status } = await request('GET', '/admin/api/payments/events', {
      token: admin.token,
      query: { kind: 'refund' },
    });
    expect(status).toBe(400);
  });

  it('pages the ledger', async () => {
    await seed();

    const { data } = await request('GET', '/admin/api/payments/events', {
      token: admin.token,
      query: { pageSize: '1', page: '2' },
    });

    expect(data).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(data.items).toHaveLength(1);
  });
});

describe('a notice about something that does not exist yet', () => {
  it('does not use up the id of the payment that later has somebody to apply it to', async () => {
    // A store renewal pushed before the app relayed the purchase: nothing to apply it to, so it is only noted...
    const eventId = `evt_${newId()}`;
    const first = await webhook([paid({ eventId, subscriptionReference: 'sub_late' })]);
    expect(first.data).toEqual({ received: 1, applied: 0 });

    // ...and when the same payment arrives again with its attempt known, it is still a payment.
    const mine = await openCheckout(ana);
    const second = await webhook([
      paid({ eventId, checkoutId: mine.id, subscriptionReference: 'sub_late' }),
    ]);

    expect(second.data).toEqual({ received: 1, applied: 1 });
    expect((await subscriptionOf(ana)).status).toBe('active');
  });

  it('still counts the same unmatched notice once', async () => {
    const eventId = `evt_${newId()}`;
    await webhook([paid({ eventId, subscriptionReference: 'sub_ghost' })]);
    await webhook([paid({ eventId, subscriptionReference: 'sub_ghost' })]);

    const lines = await db.select().from(paymentEvents);
    expect(lines.filter((line) => line.providerEventId === `unmatched:${eventId}`)).toHaveLength(1);
  });
});
