import { addBillingPeriod } from '@keres/shared/utils/billingPeriod';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import {
  auditEvents,
  paymentCheckouts,
  paymentEvents,
  paymentSubscriptions,
  registrationSettings,
  tiers,
  users,
} from '../../src/db/schema';
import * as webSocket from '../../src/modules/webSocket/webSocket.route';
import { auditService } from '../../src/services/AuditService';
import { languageOf } from '../../src/modules/payments/payment.route';
import { sanitizeAction } from '../../src/services/payments/CheckoutService';
import { setPaymentConnector } from '../../src/services/payments/PaymentConnectorRegistry';
import { subscriptionService } from '../../src/services/payments/SubscriptionService';
import { tierEnforcementService } from '../../src/services/TierEnforcementService';
import { newId, getApp, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';
import { createFakePaymentConnector } from '../helpers/fakePaymentConnector';
import { postEvents } from '../helpers/paymentEvents';

const DAY = 24 * 60 * 60 * 1000;

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let fake: ReturnType<typeof createFakePaymentConnector>;
let proId: string;
let freeId: string;
let hiddenId: string;

const checkout = (user: TestUser, body: Record<string, unknown>) =>
  request('POST', '/payments/checkout', { token: user.token, body });

/** The provider calling the webhook, as a real one would: the raw text of the body, a header to say who it is. */
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

async function openCheckout(user: TestUser, interval = 'monthly', tierId = proId) {
  const { status, data } = await checkout(user, { tierId, interval, methodId: 'card' });
  expect(status).toBe(201);
  return data as { id: string };
}

const subscriptionOf = async (user: TestUser) =>
  (
    await db.select().from(paymentSubscriptions).where(eq(paymentSubscriptions.userId, user.userId))
  )[0];

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
  proId = newId();
  freeId = newId();
  hiddenId = newId();
  await db.insert(tiers).values([
    {
      id: proId,
      name: 'Pro',
      maxStories: 50,
      priceMonthlyCents: 1990,
      priceYearlyCents: 19900,
      isPublicForSale: true,
    },
    { id: freeId, name: 'Free', maxStories: 2, priceMonthlyCents: 0, isPublicForSale: true },
    { id: hiddenId, name: 'Secret', priceMonthlyCents: 500, isPublicForSale: false },
  ]);
});

afterEach(() => {
  setPaymentConnector(null);
  vi.restoreAllMocks();
});

describe('a server with no payment plugin', () => {
  beforeEach(() => setPaymentConnector(null));

  it('says payments are off, and nothing else about them answers', async () => {
    const info = await request('GET', '/payments', { token: ana.token });
    expect(info.status).toBe(200);
    expect(info.data).toMatchObject({
      enabled: false,
      provider: null,
      methods: [],
      subscription: null,
    });

    expect(
      (await checkout(ana, { tierId: proId, interval: 'monthly', methodId: 'card' })).status,
    ).toBe(404);
    expect((await webhook([paid({})])).status).toBe(404);
    const summary = await request('GET', '/admin/api/payments/summary', { token: admin.token });
    expect(summary.data).toMatchObject({ enabled: false, provider: null });
  });

  it('keeps granting what was paid for until the date, and not after, whatever the plugin', async () => {
    const until = new Date(Date.now() + 10 * DAY);
    await db.insert(paymentSubscriptions).values({
      userId: ana.userId,
      tierId: proId,
      interval: 'monthly',
      status: 'active',
      paidUntil: until,
      amountCents: 1990,
      currency: 'BRL',
      providerId: 'gone',
    });
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);

    await db
      .update(paymentSubscriptions)
      .set({ paidUntil: new Date(Date.now() - 1000) })
      .where(eq(paymentSubscriptions.userId, ana.userId));
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).not.toBe(proId);
  });
});

describe('what the server offers', () => {
  it('names the provider, the currency and the ways to pay, and nothing of anybody else', async () => {
    const { status, data } = await request('GET', '/payments', { token: ana.token });

    expect(status).toBe(200);
    expect(data).toEqual({
      enabled: true,
      provider: { id: 'fakepay', displayName: 'Fake Pay' },
      currency: 'BRL',
      methods: [
        { id: 'card', label: 'Card' },
        { id: 'pix', label: 'PIX', description: 'Instant transfer' },
      ],
      subscription: null,
    });
  });

  it('needs a signed-in user', async () => {
    expect((await request('GET', '/payments')).status).toBe(401);
    expect((await request('POST', '/payments/checkout', { body: {} })).status).toBe(401);
  });
});

describe('starting to pay', () => {
  it('opens an attempt priced by the plan, not by what the client says, and returns what to do', async () => {
    const { status, data } = await checkout(ana, {
      tierId: proId,
      interval: 'yearly',
      methodId: 'pix',
      amountCents: 1,
      cardNumber: '4111111111111111',
    });

    expect(status).toBe(201);
    expect(data).toMatchObject({
      status: 'pending',
      tierId: proId,
      tierName: 'Pro',
      interval: 'yearly',
      amountCents: 19900,
      currency: 'BRL',
      methodId: 'pix',
      action: {
        kind: 'redirect',
        url: expect.stringMatching(/^https:\/\/pay\.example\.test\/checkout\//),
      },
    });
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({
      payer: { userId: ana.userId, username: 'ana' },
      amountCents: 19900,
      language: 'en',
    });
    // What the person typed beyond the three fields went nowhere: not to the plugin, not to the database.
    expect(JSON.stringify(fake.requests)).not.toContain('4111');
    const rows = await db.select().from(paymentCheckouts);
    expect(JSON.stringify(rows)).not.toContain('4111');
  });

  it('passes the language of the client to the plugin', async () => {
    const app = await getApp();
    await app.handle(
      new Request('http://localhost/api/payments/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${ana.token}`,
          'accept-language': 'pt-BR,pt;q=0.9',
        },
        body: JSON.stringify({ tierId: proId, interval: 'monthly', methodId: 'card' }),
      }),
    );
    expect(fake.requests[0].language).toBe('pt');
  });

  it.each([
    [
      'a plan that does not exist',
      () => ({ tierId: 'nope', interval: 'monthly', methodId: 'card' }),
      404,
    ],
    [
      'a plan that is not for sale',
      () => ({ tierId: hiddenId, interval: 'monthly', methodId: 'card' }),
      404,
    ],
    ['a free plan', () => ({ tierId: freeId, interval: 'monthly', methodId: 'card' }), 400],
    [
      'an interval the plan is not sold in',
      () => ({ tierId: freeId, interval: 'yearly', methodId: 'card' }),
      400,
    ],
    [
      'a method the plugin does not offer',
      () => ({ tierId: proId, interval: 'monthly', methodId: 'cheque' }),
      400,
    ],
    [
      'an interval that does not exist',
      () => ({ tierId: proId, interval: 'weekly', methodId: 'card' }),
      400,
    ],
    ['no method', () => ({ tierId: proId, interval: 'monthly' }), 422],
  ])('refuses %s', async (_label, body, expected) => {
    const { status } = await checkout(ana, body());
    expect([expected, 400]).toContain(status);
    expect(await db.select().from(paymentCheckouts)).toHaveLength(0);
  });

  it('closes the attempt before when a new one is opened: one at a time', async () => {
    const first = await openCheckout(ana);
    const second = await openCheckout(ana);

    const statuses = Object.fromEntries(
      (await db.select().from(paymentCheckouts)).map((row) => [row.id, row.status]),
    );
    expect(statuses[first.id]).toBe('expired');
    expect(statuses[second.id]).toBe('pending');
  });

  it('limits how many attempts a person can open in an hour', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) await openCheckout(ana);

    const { status } = await checkout(ana, {
      tierId: proId,
      interval: 'monthly',
      methodId: 'card',
    });

    expect(status).toBe(429);
    // Somebody else is not held back by it.
    expect(
      (await checkout(bia, { tierId: proId, interval: 'monthly', methodId: 'card' })).status,
    ).toBe(201);
  });

  it('turns a plugin failure into a plain refusal and keeps the failed attempt out of sight', async () => {
    fake.state.createFails = true;

    const { status, data } = await checkout(ana, {
      tierId: proId,
      interval: 'monthly',
      methodId: 'card',
    });

    expect(status).toBe(502);
    expect(data.message).toBe('Could not start the payment. Try again later.');
    expect((await db.select().from(paymentCheckouts))[0].status).toBe('failed');
  });

  it.each([
    ['a plain http address', { kind: 'redirect', url: 'http://pay.example.test/x' }],
    ['a javascript address', { kind: 'redirect', url: 'javascript:alert(1)' }],
    ['no address at all', { kind: 'redirect', url: 'not a url' }],
    ['an action that does not exist', { kind: 'launch-missiles' }],
  ])('refuses a plugin that answers %s', async (_label, action) => {
    setPaymentConnector(createFakePaymentConnector({ action: () => action as never }).connector);

    const { status } = await checkout(ana, {
      tierId: proId,
      interval: 'monthly',
      methodId: 'card',
    });

    expect(status).toBe(502);
  });

  it('records the attempt in the activity record, with the person and no payment detail', async () => {
    await openCheckout(ana);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await auditService.recordNow({ category: 'system', action: 'system.flush' });

    const rows = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, 'payment.checkout_started'),
          eq(auditEvents.actorUserId, ana.userId),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: 'payment',
      outcome: 'success',
      actorUsername: 'ana',
    });
  });
});

describe('following an attempt', () => {
  it('shows the person their own attempt and nobody else’s', async () => {
    const mine = await openCheckout(ana);

    const own = await request('GET', `/payments/checkout/${mine.id}`, { token: ana.token });
    expect(own.status).toBe(200);
    expect(own.data).toMatchObject({ id: mine.id, status: 'pending' });
    expect(
      (await request('GET', `/payments/checkout/${mine.id}`, { token: bia.token })).status,
    ).toBe(404);
    expect((await request('GET', '/payments/checkout/nothing', { token: ana.token })).status).toBe(
      404,
    );
  });

  it('closes an attempt whose time ran out, and stops offering what to do', async () => {
    const mine = await openCheckout(ana);
    await db
      .update(paymentCheckouts)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(paymentCheckouts.id, mine.id));

    const { data } = await request('GET', `/payments/checkout/${mine.id}`, { token: ana.token });

    expect(data).toMatchObject({ status: 'expired', action: null });
  });

  it('asks the provider how it ended when the plugin can, and applies the answer', async () => {
    const mine = await openCheckout(ana);
    fake.state.status = paid({ checkoutId: mine.id, subscriptionReference: 'sub_1' }) as never;
    fake.state.status = {
      ...(fake.state.status as object),
      paidAt: new Date(),
    } as never;

    const { data } = await request('GET', `/payments/checkout/${mine.id}`, { token: ana.token });

    expect(data.status).toBe('paid');
    expect(fake.getCheckoutStatus).toHaveBeenCalledTimes(1);
    expect((await subscriptionOf(ana)).status).toBe('active');

    // And not again at once for the same attempt.
    await request('GET', `/payments/checkout/${mine.id}`, { token: ana.token });
    expect(fake.getCheckoutStatus).toHaveBeenCalledTimes(1);
  });
});

describe('the provider’s notices', () => {
  it('refuses a request that is not the provider’s, and changes nothing', async () => {
    const mine = await openCheckout(ana);

    const { status } = await webhook([paid({ checkoutId: mine.id })], 'forged');

    expect(status).toBe(401);
    expect(await db.select().from(paymentSubscriptions)).toHaveLength(0);
    expect(await db.select().from(paymentEvents)).toHaveLength(0);
  });

  it('turns a first payment into a subscription paid for one period, and grants the plan', async () => {
    const mine = await openCheckout(ana);
    const nudge = vi.spyOn(webSocket, 'emitUserEvent');
    const paidAt = new Date('2026-03-03T10:00:00.000Z');

    const { status, data } = await webhook([
      paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana', paidAt: paidAt.toISOString() }),
    ]);

    expect(status).toBe(200);
    expect(data).toEqual({ received: 1, applied: 1 });
    const subscription = await subscriptionOf(ana);
    expect(subscription).toMatchObject({
      tierId: proId,
      interval: 'monthly',
      status: 'active',
      amountCents: 1990,
      providerId: 'fakepay',
      providerReference: 'sub_ana',
      cancelAtPeriodEnd: false,
    });
    // Paid on the 3rd: used until the 3rd of the next month.
    expect(subscription.paidUntil.toISOString()).toBe('2026-04-03T10:00:00.000Z');
    expect((await db.select().from(paymentCheckouts))[0].status).toBe('paid');
    expect(nudge).toHaveBeenCalledWith(ana.userId, { type: 'payments.changed' });
  });

  it('grants the plan the person paid for to the user, and to nobody else', async () => {
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);

    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);
    expect((await tierEnforcementService.getEffectiveTier(bia.userId))?.id).not.toBe(proId);
  });

  it('counts a notice once however many times the provider sends it', async () => {
    const mine = await openCheckout(ana);
    const event = paid({
      checkoutId: mine.id,
      subscriptionReference: 'sub_ana',
      eventId: 'evt_once',
    });

    await webhook([event]);
    const once = (await subscriptionOf(ana)).paidUntil.getTime();
    const again = await webhook([event, event]);

    expect(again.data).toEqual({ received: 2, applied: 0 });
    expect((await subscriptionOf(ana)).paidUntil.getTime()).toBe(once);
    expect(await db.select().from(paymentEvents)).toHaveLength(1);
  });

  it('extends a renewal from where the paid period ends, so paying early loses nothing', async () => {
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);
    const first = (await subscriptionOf(ana)).paidUntil;

    await webhook([paid({ subscriptionReference: 'sub_ana' })]);

    expect((await subscriptionOf(ana)).paidUntil.toISOString()).toBe(
      addBillingPeriod(first, 'monthly').toISOString(),
    );
  });

  it('starts a late renewal from the payment itself, not from the period that went by', async () => {
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);
    await db
      .update(paymentSubscriptions)
      .set({ status: 'due', paidUntil: new Date(Date.now() - 20 * DAY) })
      .where(eq(paymentSubscriptions.userId, ana.userId));
    const paidAt = new Date();

    await webhook([paid({ subscriptionReference: 'sub_ana', paidAt: paidAt.toISOString() })]);

    const subscription = await subscriptionOf(ana);
    expect(subscription.status).toBe('active');
    expect(subscription.paidUntil.toISOString()).toBe(
      addBillingPeriod(paidAt, 'monthly').toISOString(),
    );
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);
  });

  it('pays a year for a yearly plan', async () => {
    const mine = await openCheckout(ana, 'yearly');
    const paidAt = new Date('2026-03-03T00:00:00.000Z');
    await webhook([
      paid({ checkoutId: mine.id, amountCents: 19900, paidAt: paidAt.toISOString() }),
    ]);

    expect((await subscriptionOf(ana)).paidUntil.toISOString()).toBe('2027-03-03T00:00:00.000Z');
  });

  it('records a failed payment against the attempt, and leaves a paid subscription as it was', async () => {
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);
    const before = await subscriptionOf(ana);
    const second = await openCheckout(ana);

    await webhook([
      { type: 'payment.failed', eventId: 'evt_f1', checkoutId: second.id, reason: 'Card declined' },
      {
        type: 'payment.failed',
        eventId: 'evt_f2',
        subscriptionReference: 'sub_ana',
        reason: 'Expired card',
      },
    ]);

    const attempt = (
      await db.select().from(paymentCheckouts).where(eq(paymentCheckouts.id, second.id))
    )[0];
    expect(attempt).toMatchObject({
      status: 'failed',
      failureReason: 'Card declined',
      action: null,
    });
    const after = await subscriptionOf(ana);
    expect(after.status).toBe('active');
    expect(after.paidUntil.getTime()).toBe(before.paidUntil.getTime());
    const failures = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.kind, 'payment_failed'));
    expect(failures).toHaveLength(2);
  });

  it('notes a notice about something it never opened, and changes nothing', async () => {
    const { data } = await webhook([
      paid({ checkoutId: 'unknown', subscriptionReference: 'sub_x' }),
    ]);

    expect(data).toEqual({ received: 1, applied: 0 });
    expect(await db.select().from(paymentSubscriptions)).toHaveLength(0);
    expect((await db.select().from(paymentEvents))[0]).toMatchObject({ userId: null });
  });

  it('closes an attempt the provider says expired', async () => {
    const mine = await openCheckout(ana);

    await webhook([{ type: 'checkout.expired', eventId: 'evt_x', checkoutId: mine.id }]);

    expect((await db.select().from(paymentCheckouts))[0].status).toBe('expired');
  });

  it('lets a subscription the provider cancelled run out the period that was paid', async () => {
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);

    await webhook([
      { type: 'subscription.canceled', eventId: 'evt_c', subscriptionReference: 'sub_ana' },
    ]);

    const subscription = await subscriptionOf(ana);
    expect(subscription).toMatchObject({ status: 'active', cancelAtPeriodEnd: true });
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);
  });

  it('puts the payment in the activity record', async () => {
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);
    await auditService.recordNow({ category: 'system', action: 'system.flush' });

    const rows = await db
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.action, 'payment.succeeded'), eq(auditEvents.subjectUserId, ana.userId)),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'payment', subjectUserId: ana.userId });
    expect(JSON.stringify(rows[0].meta)).not.toMatch(/card|number|cvv/i);
  });

  it('puts a refused notice in the activity record as a failure', async () => {
    await webhook([paid({})], 'forged');
    await new Promise((resolve) => setTimeout(resolve, 50));
    await auditService.recordNow({ category: 'system', action: 'system.flush' });

    const rows = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'payment.events_rejected'));
    // Lines from the previous test may still be landing: all that matters is that this one is there.
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((row) => row.outcome === 'failure')).toBe(true);
  });
});

describe('when the paid period runs out', () => {
  async function subscribe(user: TestUser, reference = `sub_${user.username}`) {
    const mine = await openCheckout(user);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: reference })]);
  }

  it('marks it due, stops granting the plan, and tells the plugin once', async () => {
    await subscribe(ana);
    const afterPeriod = new Date(Date.now() + 31 * DAY);

    expect(await subscriptionService.markDue(afterPeriod)).toEqual({ due: 1, ended: 0 });
    expect(await subscriptionService.markDue(afterPeriod)).toEqual({ due: 0, ended: 0 });

    expect((await subscriptionOf(ana)).status).toBe('due');
    expect(fake.onSubscriptionDue).toHaveBeenCalledTimes(1);
    expect(fake.onSubscriptionDue.mock.calls[0][0]).toMatchObject({
      payer: { userId: ana.userId, username: 'ana' },
      tier: { id: proId, name: 'Pro' },
      interval: 'monthly',
      subscriptionReference: 'sub_ana',
    });
    const [ledger] = await db
      .select()
      .from(paymentEvents)
      .where(eq(paymentEvents.kind, 'subscription_due'));
    expect(ledger).toMatchObject({ userId: ana.userId, tierName: 'Pro' });
  });

  it('stops granting the plan at the date itself, before the job has run', async () => {
    await subscribe(ana);
    await db
      .update(paymentSubscriptions)
      .set({ paidUntil: new Date(Date.now() - 1000) })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    expect((await subscriptionOf(ana)).status).toBe('active');
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).not.toBe(proId);
  });

  it('brings a due subscription back when the payment arrives', async () => {
    await subscribe(ana);
    await subscriptionService.markDue(new Date(Date.now() + 31 * DAY));
    expect((await subscriptionOf(ana)).status).toBe('due');

    await webhook([paid({ subscriptionReference: 'sub_ana' })]);

    expect((await subscriptionOf(ana)).status).toBe('active');
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);
  });

  it('ends a subscription that was cancelled when its period ends, instead of marking it due', async () => {
    await subscribe(ana);
    await request('POST', '/payments/subscription/cancel', { token: ana.token });

    expect(await subscriptionService.markDue(new Date(Date.now() + 31 * DAY))).toEqual({
      due: 0,
      ended: 1,
    });

    expect((await subscriptionOf(ana)).status).toBe('canceled');
    expect(fake.onSubscriptionDue).not.toHaveBeenCalled();
  });

  it('ends a subscription left unpaid for two months', async () => {
    await subscribe(ana);
    await subscriptionService.markDue(new Date(Date.now() + 31 * DAY));

    const result = await subscriptionService.markDue(new Date(Date.now() + 100 * DAY));

    expect(result.ended).toBe(1);
    expect((await subscriptionOf(ana)).status).toBe('canceled');
  });

  it('retries telling the plugin when it failed, without marking it told', async () => {
    await subscribe(ana);
    fake.onSubscriptionDue.mockRejectedValueOnce(new Error('provider down'));
    const when = new Date(Date.now() + 31 * DAY);

    await subscriptionService.markDue(when);
    expect((await subscriptionOf(ana)).dueNotifiedAt).toBeNull();
    await subscriptionService.markDue(when);

    expect(fake.onSubscriptionDue).toHaveBeenCalledTimes(2);
    expect((await subscriptionOf(ana)).dueNotifiedAt).not.toBeNull();
  });

  it('closes the attempts nobody finished', async () => {
    const mine = await openCheckout(ana);
    await db
      .update(paymentCheckouts)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(paymentCheckouts.id, mine.id));

    await subscriptionService.markDue();

    expect((await db.select().from(paymentCheckouts))[0].status).toBe('expired');
  });
});

describe('cancelling', () => {
  it('stops the renewal, tells the provider, and keeps the plan until the period ends', async () => {
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);

    const { status, data } = await request('POST', '/payments/subscription/cancel', {
      token: ana.token,
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({ cancelAtPeriodEnd: true, status: 'active', canCancelHere: true });
    expect(fake.cancelSubscription).toHaveBeenCalledWith('sub_ana');
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);
    // Asking again is harmless and does not call the provider again.
    await request('POST', '/payments/subscription/cancel', { token: ana.token });
    expect(fake.cancelSubscription).toHaveBeenCalledTimes(1);
  });

  it('has nothing to cancel without a subscription', async () => {
    expect(
      (await request('POST', '/payments/subscription/cancel', { token: ana.token })).status,
    ).toBe(404);
  });

  it('keeps the subscription as it was when the provider refuses', async () => {
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);
    fake.state.cancelFails = true;

    const { status } = await request('POST', '/payments/subscription/cancel', { token: ana.token });

    expect(status).toBe(502);
    expect((await subscriptionOf(ana)).cancelAtPeriodEnd).toBe(false);
  });

  it('says the person has to cancel at the provider when the plugin cannot', async () => {
    setPaymentConnector(createFakePaymentConnector().connector);
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);

    const info = await request('GET', '/payments', { token: ana.token });

    expect(info.data.subscription.canCancelHere).toBe(false);
  });
});

describe('the person’s own view', () => {
  it('shows the plan, the status and the date, in the wire shape the client reads', async () => {
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);

    const { data } = await request('GET', '/payments', { token: ana.token });

    expect(data.subscription).toEqual({
      tierId: proId,
      tierName: 'Pro',
      interval: 'monthly',
      status: 'active',
      paidUntil: expect.any(String),
      lastPaymentAt: expect.any(String),
      amountCents: 1990,
      currency: 'BRL',
      cancelAtPeriodEnd: false,
      canCancelHere: true,
      autoRenews: true,
      complimentary: false,
    });
    // Another person's subscription is nowhere in it.
    expect((await request('GET', '/payments', { token: bia.token })).data.subscription).toBeNull();
  });
});

describe('what the administrators see', () => {
  async function seed() {
    const a = await openCheckout(ana);
    await webhook([paid({ checkoutId: a.id, subscriptionReference: 'sub_ana' })]);
    const b = await openCheckout(bia, 'yearly');
    await webhook([
      paid({ checkoutId: b.id, subscriptionReference: 'sub_bia', amountCents: 19900 }),
    ]);
    await db
      .update(paymentSubscriptions)
      .set({ status: 'due', paidUntil: new Date(Date.now() - DAY) })
      .where(eq(paymentSubscriptions.userId, bia.userId));
  }

  it('summarises who is paid up, late or leaving, and what came in', async () => {
    await seed();
    await webhook([{ type: 'payment.failed', eventId: 'evt_x', subscriptionReference: 'sub_bia' }]);

    const { status, data } = await request('GET', '/admin/api/payments/summary', {
      token: admin.token,
    });

    expect(status).toBe(200);
    expect(data).toMatchObject({
      enabled: true,
      provider: { id: 'fakepay', displayName: 'Fake Pay' },
      currency: 'BRL',
      subscriptions: { active: 1, due: 1, canceled: 0 },
      endingSoon: 0,
      last30Days: { payments: 2, failures: 1, amountCents: 1990 + 19900 },
      monthlyRecurringCents: 1990,
    });
  });

  it('lists the subscriptions with the situation and the key values, filterable and searchable', async () => {
    await seed();

    const all = await request('GET', '/admin/api/payments/subscriptions', { token: admin.token });
    expect(all.data.total).toBe(2);
    expect(
      all.data.items.map((item: { user: { username: string } }) => item.user.username),
    ).toEqual(['bia', 'ana']); // nearest end of period first
    expect(all.data.items[1]).toMatchObject({
      tierName: 'Pro',
      interval: 'monthly',
      status: 'active',
      amountCents: 1990,
      currency: 'BRL',
      providerId: 'fakepay',
      providerReference: 'sub_ana',
    });

    const due = await request('GET', '/admin/api/payments/subscriptions', {
      token: admin.token,
      query: { status: 'due' },
    });
    expect(
      due.data.items.map((item: { user: { username: string } }) => item.user.username),
    ).toEqual(['bia']);
    const search = await request('GET', '/admin/api/payments/subscriptions', {
      token: admin.token,
      query: { search: 'sub_ana' },
    });
    expect(search.data.total).toBe(1);
    expect(
      (
        await request('GET', '/admin/api/payments/subscriptions', {
          token: admin.token,
          query: { status: 'x' },
        })
      ).status,
    ).toBe(400);
  });

  it('shows the ledger, newest first, with the provider’s own references', async () => {
    await seed();

    const { status, data } = await request('GET', '/admin/api/payments/events', {
      token: admin.token,
    });

    expect(status).toBe(200);
    expect(data.total).toBe(2);
    expect(data.items[0]).toMatchObject({
      kind: 'payment_succeeded',
      tierName: 'Pro',
      providerId: 'fakepay',
    });
    expect(
      data.items.map((item: { user: { username: string } }) => item.user.username).sort(),
    ).toEqual(['ana', 'bia']);
  });

  it('warns when payments are in use and the server has no default plan', async () => {
    const flag = async () =>
      (await request('GET', '/admin/api/payments/summary', { token: admin.token })).data
        .noDefaultTier;

    await db.update(registrationSettings).set({ defaultTierId: null });
    expect(await flag()).toBe(true);

    await db.update(registrationSettings).set({ defaultTierId: freeId });
    expect(await flag()).toBe(false);

    // With no plugin the warning is only for a server that has subscriptions (a plan given by hand) to end.
    setPaymentConnector(null);
    await db.update(registrationSettings).set({ defaultTierId: null });
    expect(await flag()).toBe(false);
    await db.insert(paymentSubscriptions).values({
      userId: ana.userId,
      tierId: proId,
      interval: 'monthly',
      status: 'active',
      paidUntil: new Date(Date.now() + DAY),
      amountCents: 0,
      currency: 'BRL',
      providerId: 'gone',
    });
    expect(await flag()).toBe(true);
  });

  it('is for administrators only', async () => {
    expect((await request('GET', '/admin/api/payments/summary', { token: ana.token })).status).toBe(
      403,
    );
    expect(
      (await request('GET', '/admin/api/payments/subscriptions', { token: ana.token })).status,
    ).toBe(403);
    expect((await request('GET', '/admin/api/payments/events', { token: ana.token })).status).toBe(
      403,
    );
    expect((await request('GET', '/admin/api/payments/summary')).status).toBe(401);
  });

  it('holds no way to pay anywhere: not in what it keeps, not in what it shows', async () => {
    await seed();
    const shown = [
      await request('GET', '/admin/api/payments/summary', { token: admin.token }),
      await request('GET', '/admin/api/payments/subscriptions', { token: admin.token }),
      await request('GET', '/admin/api/payments/events', { token: admin.token }),
      await request('GET', '/payments', { token: ana.token }),
    ].map((response) => JSON.stringify(response.data));
    const kept = JSON.stringify([
      await db.select().from(paymentSubscriptions),
      await db.select().from(paymentCheckouts),
      await db.select().from(paymentEvents),
    ]);

    for (const text of [...shown, kept]) {
      expect(text).not.toMatch(/card_?number|cvv|cvc|pan\b|expiry|iban|account_?number/i);
    }
    for (const table of [paymentSubscriptions, paymentCheckouts, paymentEvents]) {
      const columns = Object.keys(table).join(',');
      expect(columns).not.toMatch(/card|cvv|cvc|iban|pan/i);
    }
  });
});

describe('the plan an administrator sees a person on', () => {
  const rowOf = async (id: string) => {
    const list = await request('GET', '/admin/api/users', {
      token: admin.token,
      query: { pageSize: 100 },
    });
    return list.data.items.find((item: { id: string }) => item.id === id);
  };

  it('is the paid one while the subscription is paid up, though the plan assigned stays as it was', async () => {
    await db.update(users).set({ tierId: freeId }).where(eq(users.id, ana.userId));
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);

    const inList = await rowOf(ana.userId);
    const detail = await request('GET', `/admin/api/users/${ana.userId}`, { token: admin.token });

    for (const row of [inList, detail.data]) {
      expect(row).toMatchObject({
        tierId: freeId,
        effectiveTierId: proId,
        tierSource: 'subscription',
      });
    }
    // Somebody who paid for nothing is on what they were given.
    expect(await rowOf(bia.userId)).toMatchObject({
      tierSource: expect.stringMatching(/assigned|default|none/),
    });
  });

  it('goes back to the assigned plan when the paid period ends, and to the default one when there is none', async () => {
    await db.update(users).set({ tierId: freeId }).where(eq(users.id, ana.userId));
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);
    await db
      .update(paymentSubscriptions)
      .set({ paidUntil: new Date(Date.now() - 1000) })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    expect(await rowOf(ana.userId)).toMatchObject({
      effectiveTierId: freeId,
      tierSource: 'assigned',
    });

    await db.update(users).set({ tierId: null }).where(eq(users.id, ana.userId));
    await db.update(registrationSettings).set({ defaultTierId: proId });
    expect(await rowOf(ana.userId)).toMatchObject({
      effectiveTierId: proId,
      tierSource: 'default',
    });

    await db.update(registrationSettings).set({ defaultTierId: null });
    expect(await rowOf(ana.userId)).toMatchObject({ effectiveTierId: null, tierSource: 'none' });
  });

  it('does not count a canceled subscription, even before its date', async () => {
    await db.update(users).set({ tierId: freeId }).where(eq(users.id, ana.userId));
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);
    await db
      .update(paymentSubscriptions)
      .set({ status: 'canceled' })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    expect(await rowOf(ana.userId)).toMatchObject({ tierSource: 'assigned' });
  });
});

describe('plans', () => {
  it('cannot be deleted while somebody is subscribed to them', async () => {
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);

    const { status, data } = await request('DELETE', `/admin/api/tiers/${proId}`, {
      token: admin.token,
    });

    expect(status).toBe(409);
    expect(data.message).toMatch(/subscription/);
  });

  it('is granted over the plan an administrator assigned, only while paid up', async () => {
    await db.update(users).set({ tierId: freeId }).where(eq(users.id, ana.userId));
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(freeId);
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);

    await db
      .update(paymentSubscriptions)
      .set({ paidUntil: new Date(Date.now() - 1000) })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(freeId);
  });

  it('falls back to the default plan when nothing else applies', async () => {
    await db.update(registrationSettings).set({ defaultTierId: freeId });
    const mine = await openCheckout(ana);
    await webhook([paid({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })]);
    await subscriptionService.markDue(new Date(Date.now() + 31 * DAY));
    await db
      .update(paymentSubscriptions)
      .set({ paidUntil: new Date(Date.now() - 1000) })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(freeId);
  });
});

describe('what a plugin may tell the person to do', () => {
  it('lets a hosted page, instructions or nothing through, and bounds the texts', () => {
    expect(sanitizeAction({ kind: 'none' })).toEqual({ kind: 'none' });
    expect(sanitizeAction({ kind: 'redirect', url: 'https://pay.example.test/x?a=1' })).toEqual({
      kind: 'redirect',
      url: 'https://pay.example.test/x?a=1',
    });
    const long = sanitizeAction({
      kind: 'instructions',
      title: 'T'.repeat(500),
      text: 'x'.repeat(5000),
      copyText: 'c'.repeat(2000),
    });
    expect(long).toMatchObject({ kind: 'instructions' });
    if (long.kind === 'instructions') {
      expect(long.title).toHaveLength(120);
      expect(long.text).toHaveLength(2000);
      expect(long.copyText).toHaveLength(500);
    }
    expect(sanitizeAction({ kind: 'instructions', title: 'a', text: 'b' })).toEqual({
      kind: 'instructions',
      title: 'a',
      text: 'b',
    });
  });

  it('refuses anything that is not https, and instructions with no text', () => {
    expect(() => sanitizeAction({ kind: 'redirect', url: 'http://x.test' })).toThrow(/https/);
    expect(() => sanitizeAction({ kind: 'redirect', url: 'file:///etc/passwd' })).toThrow(/https/);
    expect(() =>
      sanitizeAction({ kind: 'redirect', url: `https://x.test/${'a'.repeat(3000)}` }),
    ).toThrow();
    expect(() => sanitizeAction({ kind: 'instructions', title: 'a' } as never)).toThrow(
      /incomplete/,
    );
  });
});

describe('the language sent to the provider', () => {
  it.each([
    ['pt-BR,pt;q=0.9,en;q=0.8', 'pt'],
    ['en-US', 'en'],
    ['de', 'de'],
    ['*', 'en'],
    ['', 'en'],
    [null, 'en'],
    [undefined, 'en'],
    ['x'.repeat(40), 'en'],
  ])('reads %j as %s', (header, expected) => {
    expect(languageOf(header as string | null | undefined)).toBe(expected);
  });
});
