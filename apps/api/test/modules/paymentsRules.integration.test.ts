import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  paymentCheckouts,
  paymentEvents,
  paymentSubscriptions,
  playPurchaseClaims,
  tiers,
  users,
} from '../../src/db/schema';
import { setPaymentConnector } from '../../src/services/payments/PaymentConnectorRegistry';
import { PaymentRetentionService } from '../../src/services/payments/PaymentRetentionService';
import { tierEnforcementService } from '../../src/services/TierEnforcementService';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';
import { createFakePaymentConnector } from '../helpers/fakePaymentConnector';
import { postEvents } from '../helpers/paymentEvents';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let admin: TestUser;
let ana: TestUser;
let proId: string;
let fake: ReturnType<typeof createFakePaymentConnector>;

const paid = (over: Record<string, unknown> = {}) => ({
  type: 'payment.succeeded',
  eventId: `evt_${newId()}`,
  paidAt: new Date().toISOString(),
  amountCents: 1990,
  currency: 'BRL',
  ...over,
});

const refund = (over: Record<string, unknown> = {}) => ({
  type: 'payment.refunded',
  eventId: `refund_${newId()}`,
  subscriptionReference: 'sub_ana',
  refundedAt: new Date().toISOString(),
  chargedAt: new Date().toISOString(),
  amountCents: 1990,
  currency: 'BRL',
  endsAccess: true,
  ...over,
});

async function subscribe(user: TestUser, reference = 'sub_ana'): Promise<string> {
  const { data } = await request('POST', '/payments/checkout', {
    token: user.token,
    body: { tierId: proId, interval: 'monthly', methodId: 'card' },
  });
  const checkoutId = (data as { id: string }).id;
  await postEvents([paid({ checkoutId, subscriptionReference: reference })]);
  return checkoutId;
}

const row = async (user: TestUser) =>
  (
    await db.select().from(paymentSubscriptions).where(eq(paymentSubscriptions.userId, user.userId))
  )[0];

/** A renewal comes a month after the payment it follows: the one the server took is moved back that far. */
const agePayment = (user: TestUser) =>
  db
    .update(paymentSubscriptions)
    .set({ lastPaymentAt: new Date(Date.now() - 30 * DAY) })
    .where(eq(paymentSubscriptions.userId, user.userId));

beforeEach(async () => {
  await truncateAll();
  fake = createFakePaymentConnector({
    withCancel: true,
    withReconcile: true,
    withStatusPolling: true,
  });
  setPaymentConnector(fake.connector);
  admin = await registerUser('root');
  await promoteToAdmin(admin.userId);
  ana = await registerUser('ana');
  proId = newId();
  await db
    .insert(tiers)
    .values({ id: proId, name: 'Pro', priceMonthlyCents: 1990, isPublicForSale: true });
});

afterEach(() => {
  setPaymentConnector(null);
});

describe('money that went back', () => {
  it('takes back the period of the latest payment when it is refunded in full', async () => {
    await subscribe(ana);
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).toBe(proId);

    const { data } = await postEvents([refund()]);

    expect(data).toEqual({ received: 1, applied: 1 });
    expect(await row(ana)).toMatchObject({ status: 'canceled', cancelAtPeriodEnd: true });
    expect((await row(ana)).paidUntil.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect((await tierEnforcementService.getEffectiveTier(ana.userId))?.id).not.toBe(proId);
  });

  it('only notes a partial refund: the period stands', async () => {
    await subscribe(ana);
    const before = await row(ana);

    await postEvents([refund({ amountCents: 500, endsAccess: false })]);

    expect(await row(ana)).toMatchObject({ status: 'active', cancelAtPeriodEnd: false });
    expect((await row(ana)).paidUntil.getTime()).toBe(before.paidUntil.getTime());
  });

  it('does not end the current period for the refund of an earlier payment', async () => {
    await subscribe(ana);
    await agePayment(ana);
    await postEvents([
      paid({ subscriptionReference: 'sub_ana', paidAt: new Date().toISOString() }),
    ]);
    const before = await row(ana);

    // The first month's charge, long ago, refunded in full.
    await postEvents([refund({ chargedAt: new Date(Date.now() - 31 * DAY).toISOString() })]);

    expect(await row(ana)).toMatchObject({ status: 'active' });
    expect((await row(ana)).paidUntil.getTime()).toBe(before.paidUntil.getTime());
  });

  it("counts it once, shows it on the ledger and in the person's own history, and in the summary", async () => {
    await subscribe(ana);
    const notice = refund();

    await postEvents([notice]);
    const again = await postEvents([notice]);

    expect(again.data).toEqual({ received: 1, applied: 0 });
    const history = await request('GET', '/payments/history', { token: ana.token });
    expect(history.data.items.map((item: { kind: string }) => item.kind)).toContain(
      'payment_refunded',
    );
    const ledger = await request('GET', '/admin/api/payments/events', {
      token: admin.token,
      query: { kind: 'payment_refunded' },
    });
    expect(ledger.data.total).toBe(1);
    const summary = await request('GET', '/admin/api/payments/summary', { token: admin.token });
    expect(summary.data.last30Days.refundedCents).toBe(1990);
  });

  it("is only noted, with nobody to apply it to, when the subscription is not this server's", async () => {
    const { data } = await postEvents([refund({ subscriptionReference: 'sub_ghost' })]);

    expect(data).toEqual({ received: 1, applied: 0 });
    expect(await db.select().from(paymentSubscriptions)).toHaveLength(0);
  });
});

describe('notices that arrive out of order', () => {
  it('does not bring a cancelled subscription back when a renewal notice arrives after the cancellation', async () => {
    await subscribe(ana);
    await postEvents([
      { type: 'subscription.canceled', eventId: 'cancel_1', subscriptionReference: 'sub_ana' },
    ]);
    expect((await row(ana)).cancelAtPeriodEnd).toBe(true);
    await agePayment(ana);

    // The renewal that was charged just before the cancellation, delivered after it.
    await postEvents([paid({ subscriptionReference: 'sub_ana' })]);

    expect((await row(ana)).cancelAtPeriodEnd).toBe(true);
  });

  it('lifts the cancellation for somebody who subscribes again with a new attempt', async () => {
    await subscribe(ana);
    await postEvents([
      { type: 'subscription.canceled', eventId: 'cancel_1', subscriptionReference: 'sub_ana' },
    ]);
    await agePayment(ana);
    const { data } = await request('POST', '/payments/checkout', {
      token: ana.token,
      body: { tierId: proId, interval: 'monthly', methodId: 'card' },
    });

    await postEvents([
      paid({ checkoutId: (data as { id: string }).id, subscriptionReference: 'sub_ana' }),
    ]);

    expect((await row(ana)).cancelAtPeriodEnd).toBe(false);
  });

  it('lifts it for a new subscription at the provider named on an attempt that was already paid (a store purchase again)', async () => {
    const attempt = await subscribe(ana);
    await postEvents([
      { type: 'subscription.canceled', eventId: 'cancel_1', subscriptionReference: 'sub_ana' },
    ]);
    await agePayment(ana);

    await postEvents([paid({ checkoutId: attempt, subscriptionReference: 'sub_ana_second' })]);

    expect(await row(ana)).toMatchObject({
      cancelAtPeriodEnd: false,
      providerReference: 'sub_ana_second',
    });
  });

  it('never shortens what is paid with an old renewal notice', async () => {
    await subscribe(ana);
    await agePayment(ana);
    const longer = new Date(Date.now() + 90 * DAY);
    await db
      .update(paymentSubscriptions)
      .set({ paidUntil: longer })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    await postEvents([
      paid({
        subscriptionReference: 'sub_ana',
        paidAt: new Date(Date.now() - 40 * DAY).toISOString(),
      }),
    ]);

    expect((await row(ana)).paidUntil.getTime()).toBeGreaterThanOrEqual(longer.getTime());
  });
});

describe('the same charge under two ids', () => {
  it('is granted once: the second announcement is noted as turned down', async () => {
    await subscribe(ana);
    const before = await row(ana);

    const { data } = await postEvents([
      paid({ subscriptionReference: 'sub_ana', eventId: 'announced_again_under_another_id' }),
    ]);

    expect(data).toEqual({ received: 1, applied: 0 });
    expect((await row(ana)).paidUntil.getTime()).toBe(before.paidUntil.getTime());
    const history = await request('GET', '/payments/history', { token: ana.token });
    expect(history.data.items).toHaveLength(1);
  });

  it('does not take a payment of the same amount for a different plan as a repeat', async () => {
    await subscribe(ana);
    const other = newId();
    await db
      .insert(tiers)
      .values({ id: other, name: 'Plus', priceMonthlyCents: 1990, isPublicForSale: true });
    const { data } = await request('POST', '/payments/checkout', {
      token: ana.token,
      body: { tierId: other, interval: 'monthly', methodId: 'card' },
    });

    const result = await postEvents([
      paid({ checkoutId: (data as { id: string }).id, subscriptionReference: 'sub_ana_plus' }),
    ]);

    expect(result.data).toEqual({ received: 1, applied: 1 });
    expect((await row(ana)).tierId).toBe(other);
  });
});

describe('what the administrators see of a store purchase token', () => {
  it('shows its ends only, and the ids of the other providers whole', async () => {
    const token = `ofbcjdkhgcdjliaejnmcjhki.${'AO-J1Oy'.repeat(40)}`;
    await subscribe(ana, token);

    const list = await request('GET', '/admin/api/payments/subscriptions', { token: admin.token });
    const ledger = await request('GET', '/admin/api/payments/events', { token: admin.token });

    const shown = list.data.items[0].providerReference as string;
    expect(shown.length).toBeLessThan(30);
    expect(shown.startsWith('ofbcjdkh')).toBe(true);
    expect(JSON.stringify(ledger.data)).not.toContain(token);
    // The server itself keeps what it needs to look the purchase up.
    expect((await row(ana)).providerReference).toBe(token);

    const bia = await registerUser('bia');
    await subscribe(bia, 'sub_bia_short');
    const again = await request('GET', '/admin/api/payments/subscriptions', { token: admin.token });
    expect(JSON.stringify(again.data)).toContain('sub_bia_short');
  });
});

describe('the health panel', () => {
  const health = async () =>
    (await request('GET', '/admin/api/payments/health', { token: admin.token })).data;

  it('says the connector is there and when the last notice came', async () => {
    await subscribe(ana);

    const found = await health();

    expect(found.connector).toMatchObject({ connected: true, id: 'fakepay' });
    expect(new Date(found.lastNoticeAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(found.warnings).toEqual([]);
    expect(found.overdue).toEqual({ renewing: 0, due: 0 });
  });

  it('is for administrators only', async () => {
    expect((await request('GET', '/admin/api/payments/health', { token: ana.token })).status).toBe(
      403,
    );
    expect((await request('GET', '/admin/api/payments/health')).status).toBe(401);
  });

  it('counts what is late and what the server never opened, and warns', async () => {
    await subscribe(ana);
    await db
      .update(paymentSubscriptions)
      .set({ status: 'due', paidUntil: new Date(Date.now() - 20 * DAY) })
      .where(eq(paymentSubscriptions.userId, ana.userId));
    await postEvents([paid({ subscriptionReference: 'sub_ghost' })]);

    const found = await health();

    expect(found.overdue.due).toBe(1);
    expect(found.unmatched7d).toBe(1);
    expect(found.warnings).toEqual(expect.arrayContaining(['overdue', 'unmatched']));
  });

  it('warns that there is no connector when the server is pointed at one that is not answering', async () => {
    setPaymentConnector(null);
    const original = process.env.PAYMENT_CONNECTOR_URL;
    // The configuration is read when the server starts: here the registry is what says it is not connected.
    const found = await health();

    expect(found.connector.connected).toBe(false);
    process.env.PAYMENT_CONNECTOR_URL = original;
  });
});

describe('letting go of a closed account', () => {
  const service = new PaymentRetentionService();
  const close = (user: TestUser, daysAgo: number) =>
    db
      .update(users)
      .set({ isDeleted: true, deletedAt: new Date(Date.now() - daysAgo * DAY) })
      .where(eq(users.id, user.userId));

  it('does nothing unless it was asked for', async () => {
    await subscribe(ana);
    await db
      .update(paymentSubscriptions)
      .set({ status: 'canceled' })
      .where(eq(paymentSubscriptions.userId, ana.userId));
    await close(ana, 400);

    expect(await service.run(new Date(), undefined)).toEqual({ accounts: 0 });
    expect(await db.select().from(paymentSubscriptions)).toHaveLength(1);
  });

  it('deletes what serves the person and keeps the ledger without the person', async () => {
    await subscribe(ana, 'sub_ana');
    await db
      .insert(playPurchaseClaims)
      .values({ purchaseTokenHash: 'h', userId: ana.userId, productId: 'p' });
    await db
      .update(paymentSubscriptions)
      .set({ status: 'canceled' })
      .where(eq(paymentSubscriptions.userId, ana.userId));
    const linesBefore = (await db.select().from(paymentEvents)).length;
    await close(ana, 400);

    expect(await service.run(new Date(), 365)).toEqual({ accounts: 1 });

    expect(await db.select().from(paymentSubscriptions)).toHaveLength(0);
    expect(await db.select().from(paymentCheckouts)).toHaveLength(0);
    expect(await db.select().from(playPurchaseClaims)).toHaveLength(0);
    const lines = await db.select().from(paymentEvents);
    expect(lines).toHaveLength(linesBefore);
    expect(lines.every((line) => line.userId === null && line.providerReference === null)).toBe(
      true,
    );
    expect(lines.some((line) => line.amountCents === 1990)).toBe(true);
    // Done: the next run has nothing left to do.
    expect(await service.run(new Date(), 365)).toEqual({ accounts: 0 });
  });

  it('leaves an account that was closed recently, and one that may still be charged', async () => {
    await subscribe(ana, 'sub_ana');
    await close(ana, 400);
    // Closed long ago but the subscription is still live at the provider: it has to end first.
    expect(await service.run(new Date(), 365)).toEqual({ accounts: 0 });
    expect(await db.select().from(paymentSubscriptions)).toHaveLength(1);

    await db
      .update(paymentSubscriptions)
      .set({ status: 'canceled' })
      .where(eq(paymentSubscriptions.userId, ana.userId));
    await close(ana, 10);
    expect(await service.run(new Date(), 365)).toEqual({ accounts: 0 });
  });
});
