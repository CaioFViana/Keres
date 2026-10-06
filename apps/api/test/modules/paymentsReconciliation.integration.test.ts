import { PAYMENT_RENEWAL_GRACE_HOURS } from '@keres/shared/metadata/Payments';
import type { PaymentEvent } from '@keres/shared/payments/PaymentConnector';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { paymentCheckouts, paymentSubscriptions, tiers } from '../../src/db/schema';
import { setPaymentConnector } from '../../src/services/payments/PaymentConnectorRegistry';
import { PaymentReconciliationService } from '../../src/services/payments/PaymentReconciliationService';
import { subscriptionService } from '../../src/services/payments/SubscriptionService';
import { tierEnforcementService } from '../../src/services/TierEnforcementService';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';
import { createFakePaymentConnector } from '../helpers/fakePaymentConnector';
import { postEvents } from '../helpers/paymentEvents';

/**
 * The safety net under the webhooks: a notice that never came is found by asking the provider. What it asks
 * about, what it leaves alone, and that what it finds is applied exactly like a webhook (so nothing counts twice).
 */
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let proId: string;
let fake: ReturnType<typeof createFakePaymentConnector>;
let service: PaymentReconciliationService;

const paidWire = (over: Record<string, unknown>) => ({
  type: 'payment.succeeded',
  eventId: `evt_${newId()}`,
  paidAt: new Date().toISOString(),
  amountCents: 1990,
  currency: 'BRL',
  ...over,
});

const renewal = (
  over: Partial<Extract<PaymentEvent, { type: 'payment.succeeded' }>> = {},
): PaymentEvent => ({
  type: 'payment.succeeded',
  eventId: `sale_${newId()}`,
  subscriptionReference: 'sub_ana',
  // A renewal comes after the payment it follows, not in the same minute.
  paidAt: new Date(Date.now() + HOUR),
  amountCents: 1990,
  currency: 'BRL',
  ...over,
});

async function openCheckout(user: TestUser) {
  const { status, data } = await request('POST', '/payments/checkout', {
    token: user.token,
    body: { tierId: proId, interval: 'monthly', methodId: 'card' },
  });
  expect(status).toBe(201);
  return data as { id: string };
}

/** A subscription whose first payment the server did see, under a known notice id. */
async function subscribe(user: TestUser, reference: string, firstEventId = `evt_${newId()}`) {
  const mine = await openCheckout(user);
  await postEvents([
    paidWire({ eventId: firstEventId, checkoutId: mine.id, subscriptionReference: reference }),
  ]);
}

const row = async (user: TestUser) =>
  (
    await db.select().from(paymentSubscriptions).where(eq(paymentSubscriptions.userId, user.userId))
  )[0];

const endedHoursAgo = (user: TestUser, hours: number, extra: Record<string, unknown> = {}) =>
  db
    .update(paymentSubscriptions)
    .set({ paidUntil: new Date(Date.now() - hours * HOUR), ...extra })
    .where(eq(paymentSubscriptions.userId, user.userId));

beforeEach(async () => {
  await truncateAll();
  fake = createFakePaymentConnector({
    withReconcile: true,
    withStatusPolling: true,
    withCancel: true,
  });
  setPaymentConnector(fake.connector);
  service = new PaymentReconciliationService();
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  bia = await registerUser('bia');
  proId = newId();
  await db.insert(tiers).values({
    id: proId,
    name: 'Pro',
    priceMonthlyCents: 1990,
    isPublicForSale: true,
  });
});

afterEach(() => {
  setPaymentConnector(null);
});

describe('a renewal whose notice never came', () => {
  it('is found by asking the provider, and applied like a webhook would have been', async () => {
    await subscribe(ana, 'sub_ana');
    await endedHoursAgo(ana, 3);
    fake.state.reconcileEvents = [
      renewal({ eventId: 'sale_late', paidAt: new Date(Date.now() - 2 * HOUR) }),
    ];

    const found = await service.run();

    expect(found).toMatchObject({ subscriptions: 1, applied: 1 });
    const after = await row(ana);
    expect(after.status).toBe('active');
    expect(after.paidUntil.getTime()).toBeGreaterThan(Date.now());
    expect(fake.reconcileSubscription).toHaveBeenCalledTimes(1);
    const [reference, since] = fake.reconcileSubscription.mock.calls[0];
    expect(reference).toBe('sub_ana');
    // From a day before the last payment: what was already applied is recognised by its id.
    expect(since.getTime()).toBeLessThan(Date.now() - DAY);
  });

  it('is not counted twice when it did arrive: the same notice id is a duplicate', async () => {
    await subscribe(ana, 'sub_ana', 'sale_first');
    await endedHoursAgo(ana, 3);
    const before = await row(ana);
    fake.state.reconcileEvents = [renewal({ eventId: 'sale_first' })];

    const found = await service.run();

    expect(found.applied).toBe(0);
    expect((await row(ana)).paidUntil.getTime()).toBe(before.paidUntil.getTime());
  });

  it('brings a subscription that already went due back, and its plan with it', async () => {
    await subscribe(ana, 'sub_ana');
    await endedHoursAgo(ana, PAYMENT_RENEWAL_GRACE_HOURS + 5);
    await subscriptionService.markDue();
    expect((await row(ana)).status).toBe('due');
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).not.toBe(proId);
    fake.state.reconcileEvents = [renewal({ paidAt: new Date(Date.now() - HOUR) })];

    await service.run();

    expect((await row(ana)).status).toBe('active');
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);
  });

  it('applies several missed renewals in the order they were charged', async () => {
    await subscribe(ana, 'sub_ana');
    await endedHoursAgo(ana, 3 * 24);
    fake.state.reconcileEvents = [
      renewal({ eventId: 'sale_2', paidAt: new Date(Date.now() - 1 * DAY) }),
      renewal({ eventId: 'sale_1', paidAt: new Date(Date.now() - 2 * DAY) }),
    ];

    const found = await service.run();

    expect(found.applied).toBe(2);
    expect((await row(ana)).status).toBe('active');
  });

  it('learns that the provider ended the subscription, and stops asking about it', async () => {
    await subscribe(ana, 'sub_ana');
    await endedHoursAgo(ana, 3);
    fake.state.reconcileEvents = [
      { type: 'subscription.canceled', eventId: 'cancel_1', subscriptionReference: 'sub_ana' },
    ];

    await service.run();
    expect((await row(ana)).cancelAtPeriodEnd).toBe(true);
    fake.reconcileSubscription.mockClear();
    await new PaymentReconciliationService().run();

    // Ending is not renewing: nothing left to ask.
    expect(fake.reconcileSubscription).not.toHaveBeenCalled();
  });
});

describe('what it leaves alone', () => {
  it('does not ask about a subscription that is paid ahead, ending, given, or bought in a store', async () => {
    // ana: paid ahead. bia: ended (period over) but renewal already stopped.
    await subscribe(ana, 'sub_ana');
    await subscribe(bia, 'sub_bia');
    await endedHoursAgo(bia, 3, { cancelAtPeriodEnd: true });
    // cris: a plan given by an administrator, over.
    const cris = await registerUser('cris');
    await request('POST', `/admin/api/payments/users/${cris.userId}/gift`, {
      token: admin.token,
      body: { tierId: proId, months: 1 },
    });
    await endedHoursAgo(cris, 3);
    // dina: bought in the store, over.
    const stores = createFakePaymentConnector({
      withReconcile: true,
      methods: [{ id: 'playbilling', label: 'Google Play', flow: 'native', store: 'play' }],
    });
    setPaymentConnector(stores.connector);
    const dina = await registerUser('dina');
    const attempt = await request('POST', '/payments/checkout', {
      token: dina.token,
      body: { tierId: proId, interval: 'monthly', methodId: 'playbilling' },
    });
    await postEvents([
      paidWire({
        checkoutId: (attempt.data as { id: string }).id,
        subscriptionReference: 'play-token',
      }),
    ]);
    await endedHoursAgo(dina, 3);

    const found = await new PaymentReconciliationService().run();

    expect(found.subscriptions).toBe(0);
    expect(stores.reconcileSubscription).not.toHaveBeenCalled();
    expect(fake.reconcileSubscription).not.toHaveBeenCalled();
  });

  it('does nothing without a connector, or with one that cannot reconcile', async () => {
    await subscribe(ana, 'sub_ana');
    await endedHoursAgo(ana, 3);

    setPaymentConnector(null);
    expect(await service.run()).toEqual({ subscriptions: 0, checkouts: 0, applied: 0 });

    const limited = createFakePaymentConnector({});
    setPaymentConnector(limited.connector);
    expect(await service.run()).toEqual({ subscriptions: 0, checkouts: 0, applied: 0 });
  });
});

describe('when the provider cannot answer', () => {
  it('goes on to the next one, changes nothing for the one that failed, and does not throw', async () => {
    await subscribe(ana, 'sub_ana');
    await subscribe(bia, 'sub_bia');
    await endedHoursAgo(ana, 3);
    await endedHoursAgo(bia, 4);
    // The oldest is asked first (bia), and fails; ana is still asked.
    fake.reconcileSubscription.mockRejectedValueOnce(new Error('provider down'));
    fake.state.reconcileEvents = [renewal({ subscriptionReference: 'sub_ana' })];

    const found = await service.run();

    expect(found.subscriptions).toBe(2);
    expect(found.applied).toBe(1);
    expect((await row(bia)).paidUntil.getTime()).toBeLessThan(Date.now());
    expect((await row(ana)).paidUntil.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('how often it asks', () => {
  it('asks about a renewal that is only just late at every run, and about a long-late one now and then', async () => {
    await subscribe(ana, 'sub_ana');
    await endedHoursAgo(ana, 5);
    const at = Date.now();

    await service.run(new Date(at));
    await service.run(new Date(at + 15 * 60 * 1000));
    expect(fake.reconcileSubscription).toHaveBeenCalledTimes(2);

    await endedHoursAgo(ana, 5 * 24);
    fake.reconcileSubscription.mockClear();
    const later = new PaymentReconciliationService();
    await later.run(new Date(at));
    await later.run(new Date(at + 15 * 60 * 1000));
    await later.run(new Date(at + 2 * HOUR));
    expect(fake.reconcileSubscription).toHaveBeenCalledTimes(1);
    await later.run(new Date(at + 7 * HOUR));
    expect(fake.reconcileSubscription).toHaveBeenCalledTimes(2);
  });

  it('is run before the job that marks what is unpaid: a renewal found is never called late', async () => {
    await subscribe(ana, 'sub_ana');
    await endedHoursAgo(ana, PAYMENT_RENEWAL_GRACE_HOURS + 5);
    fake.state.reconcileEvents = [renewal({ paidAt: new Date(Date.now() - HOUR) })];

    // What the scheduler does, in its order.
    await service.run();
    const marked = await subscriptionService.markDue();

    expect(marked).toEqual({ due: 0, ended: 0 });
    expect((await row(ana)).status).toBe('active');
  });
});

describe('a payment made while nobody was looking', () => {
  const paidFor = (checkoutId: string): PaymentEvent => ({
    type: 'payment.succeeded',
    eventId: `evt_${newId()}`,
    checkoutId,
    subscriptionReference: 'sub_ana',
    paidAt: new Date(),
    amountCents: 1990,
    currency: 'BRL',
  });

  it('is found for an attempt that was opened and never watched to its end', async () => {
    const attempt = await openCheckout(ana);
    fake.state.status = paidFor(attempt.id);

    const found = await service.run();

    expect(found).toMatchObject({ checkouts: 1, applied: 1 });
    expect((await row(ana)).status).toBe('active');
    expect(fake.getCheckoutStatus).toHaveBeenCalledWith(attempt.id, expect.any(String));
  });

  it('is found even when the attempt had already expired, within three days', async () => {
    const attempt = await openCheckout(ana);
    await db
      .update(paymentCheckouts)
      .set({ status: 'expired', createdAt: new Date(Date.now() - 2 * DAY) })
      .where(eq(paymentCheckouts.id, attempt.id));
    fake.state.status = paidFor(attempt.id);

    await service.run();

    expect((await row(ana)).status).toBe('active');
  });

  it('is not looked for past three days, or in an attempt that already ended', async () => {
    const old = await openCheckout(ana);
    await db
      .update(paymentCheckouts)
      .set({ status: 'expired', createdAt: new Date(Date.now() - 4 * DAY) })
      .where(eq(paymentCheckouts.id, old.id));
    const done = await openCheckout(bia);
    await db
      .update(paymentCheckouts)
      .set({ status: 'failed' })
      .where(eq(paymentCheckouts.id, done.id));
    fake.state.status = paidFor(old.id);

    const found = await service.run();

    expect(found.checkouts).toBe(0);
    expect(fake.getCheckoutStatus).not.toHaveBeenCalled();
  });

  it('asks about a still-open attempt only now and then once it is old, not at every run', async () => {
    const attempt = await openCheckout(ana);
    await db
      .update(paymentCheckouts)
      .set({ createdAt: new Date(Date.now() - 5 * HOUR) })
      .where(eq(paymentCheckouts.id, attempt.id));
    const at = Date.now();

    await service.run(new Date(at));
    await service.run(new Date(at + 15 * 60 * 1000));
    expect(fake.getCheckoutStatus).toHaveBeenCalledTimes(1);
    await service.run(new Date(at + 4 * HOUR));
    expect(fake.getCheckoutStatus).toHaveBeenCalledTimes(2);
  });
});
