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
import { setPaymentPlugin } from '../../src/services/payments/PaymentPluginRegistry';
import { subscriptionService } from '../../src/services/payments/SubscriptionService';
import { getApp, newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';
import {
  createFakePaymentPlugin,
  FAKE_SIGNATURE_HEADER,
  FAKE_VALID_SIGNATURE,
  webhookBody,
} from '../helpers/fakePaymentPlugin';

/**
 * The corners of the payment services the main suite (payments.integration.test.ts) walks past: notices that
 * arrive twice or about nothing, subscriptions in a state that makes an action meaningless, plugins that
 * offer less than the whole contract, and the administrators' lists under each ordering.
 */
const DAY = 24 * 60 * 60 * 1000;

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let cris: TestUser;
let fake: ReturnType<typeof createFakePaymentPlugin>;
let proId: string;

async function webhook(events: Record<string, unknown>[]) {
  const app = await getApp();
  const response = await app.handle(
    new Request('http://localhost/api/payments/webhook', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', [FAKE_SIGNATURE_HEADER]: FAKE_VALID_SIGNATURE },
      body: webhookBody(events),
    }),
  );
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

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
  fake = createFakePaymentPlugin({ withCancel: true, withDueHook: true, withStatusPolling: true });
  setPaymentPlugin(fake.plugin);
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
  setPaymentPlugin(null);
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

  it('does nothing for a cancellation of a subscription that was never paid', async () => {
    const mine = await openCheckout(ana);

    // The attempt gives the person, but there is no subscription to cancel yet.
    const { data } = await webhook([
      { type: 'subscription.canceled', eventId: 'evt_c', checkoutId: mine.id },
    ]);

    expect(data).toEqual({ received: 1, applied: 0 });
    expect(await db.select().from(paymentSubscriptions)).toHaveLength(0);
  });

  it('does nothing for an expiry of an attempt it does not know, found only by the subscription', async () => {
    await subscribe(ana);

    const { data } = await webhook([
      { type: 'checkout.expired', eventId: 'evt_e', subscriptionReference: 'sub_ana' },
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
    await subscriptionService.markDue(new Date(Date.now() + 31 * DAY));
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

  it('leaves an attempt that was paid as it was when the payment is reported again with a new id', async () => {
    const mine = await subscribe(ana);
    const before = await subscriptionOf(ana);

    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);

    expect((await db.select().from(paymentCheckouts))[0].status).toBe('paid');
    // Paid twice, so the period went on: nothing was lost.
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
    setPaymentPlugin(null);

    expect(
      (await request('POST', '/payments/subscription/cancel', { token: ana.token })).status,
    ).toBe(404);
  });

  it('has nothing to cancel once the subscription is due', async () => {
    await subscribe(ana);
    await subscriptionService.markDue(new Date(Date.now() + 31 * DAY));

    expect(
      (await request('POST', '/payments/subscription/cancel', { token: ana.token })).status,
    ).toBe(404);
  });

  it('only flags it, without calling the provider, when the plugin cannot cancel', async () => {
    const limited = createFakePaymentPlugin();
    setPaymentPlugin(limited.plugin);
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

describe('what the person sees of payments', () => {
  it('still answers when the plugin cannot list its ways to pay', async () => {
    fake.plugin.listMethods = (() => Promise.reject(new Error('boom'))) as never;
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
    const quiet = createFakePaymentPlugin({ withCancel: true });
    setPaymentPlugin(quiet.plugin);
    await subscribe(ana);

    expect(await subscriptionService.markDue(new Date(Date.now() + 31 * DAY))).toEqual({
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

    await subscriptionService.markDue(new Date(Date.now() + 31 * DAY));

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
