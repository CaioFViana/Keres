import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db';
import {
  paymentCheckouts,
  paymentSubscriptions,
  playPurchaseClaims,
  tiers,
} from '../../src/db/schema';
import { setPaymentConnector } from '../../src/services/payments/PaymentConnectorRegistry';
import { hashPurchaseToken } from '../../src/services/payments/playPurchaseClaims';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';
import { createFakePaymentConnector } from '../helpers/fakePaymentConnector';
import { ConnectorError } from '../../src/services/payments/connector/signedClient';
import { postEvents } from '../helpers/paymentEvents';

let ana: TestUser;
let proId: string;
let fake: ReturnType<typeof createFakePaymentConnector>;

const relay = (user: TestUser | null, body: Record<string, unknown>) =>
  request('POST', '/payments/play/verify', user ? { token: user.token, body } : { body });

const purchase = (over: Record<string, unknown> = {}) => ({
  tierId: proId,
  interval: 'monthly',
  productId: 'plus_monthly',
  purchaseToken: 'token-abc',
  packageName: 'com.test.app',
  ...over,
});

beforeEach(async () => {
  await truncateAll();
  ana = await registerUser('ana');
  proId = newId();
  await db.insert(tiers).values([
    {
      id: proId,
      name: 'Pro',
      maxStories: 50,
      priceMonthlyCents: 1990,
      priceYearlyCents: 19900,
      playMonthlyProductId: 'plus_monthly',
      playYearlyProductId: 'plus_yearly',
      isPublicForSale: true,
    },
  ]);
  // Like the service: checking the token reports the purchase as a signed event naming the attempt.
  fake = createFakePaymentConnector({
    methods: [{ id: 'playbilling', label: 'Google Play', flow: 'native', store: 'play' }],
    verifyPlay: async (verified) => {
      await postEvents([
        {
          type: 'payment.succeeded',
          eventId: `evt_${verified.checkoutId}`,
          checkoutId: verified.checkoutId,
          subscriptionReference: verified.purchaseToken,
          paidAt: new Date().toISOString(),
          amountCents: verified.amountCents,
          currency: verified.currency,
        },
      ]);
      return { active: true, orderId: 'GPA.1234' };
    },
  });
  setPaymentConnector(fake.connector);
});

afterEach(() => {
  setPaymentConnector(null);
  vi.restoreAllMocks();
});

describe('relaying a store purchase', () => {
  it('grants the plan the token paid for, priced by the server', async () => {
    const { status, data } = await relay(ana, purchase());

    expect(status).toBe(200);
    expect(data.active).toBe(true);
    expect(data.subscription.tierId).toBe(proId);
    expect(data.subscription.status).toBe('active');

    // The user, the price and the attempt are the server's own - never the app's word.
    const [asked] = fake.verifyPlayPurchase.mock.calls[0];
    expect(asked).toMatchObject({
      userId: ana.userId,
      productId: 'plus_monthly',
      purchaseToken: 'token-abc',
      purchaseKind: 'subscription',
      amountCents: 1990,
      currency: 'BRL',
    });
    const attemptId = asked.checkoutId;
    expect(typeof attemptId).toBe('string');

    const [row] = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.userId, ana.userId));
    expect(row.status).toBe('active');
    expect(row.tierId).toBe(proId);
    const [attempt] = await db
      .select()
      .from(paymentCheckouts)
      .where(eq(paymentCheckouts.id, attemptId as string));
    expect(attempt.status).toBe('paid');
    expect(attempt.methodId).toBe('playbilling');
  });

  it('refuses a product that does not sell the plan', async () => {
    const { status } = await relay(ana, purchase({ productId: 'basic_monthly' }));

    expect(status).toBe(400);
    expect(fake.verifyPlayPurchase).not.toHaveBeenCalled();
  });

  it('refuses a plan the store does not sell', async () => {
    const freeId = newId();
    await db
      .insert(tiers)
      .values([
        { id: freeId, name: 'Free', maxStories: 2, priceMonthlyCents: 0, isPublicForSale: true },
      ]);

    const { status } = await relay(ana, purchase({ tierId: freeId }));

    expect(status).toBe(400);
    expect(fake.verifyPlayPurchase).not.toHaveBeenCalled();
  });

  it('marks the attempt failed when the store does not confirm the purchase', async () => {
    fake.connector.verifyPlayPurchase = async () => ({ active: false });

    const { status, data } = await relay(ana, purchase());

    expect(status).toBe(200);
    expect(data).toEqual({ active: false, subscription: null });
    const attempts = await db
      .select()
      .from(paymentCheckouts)
      .where(eq(paymentCheckouts.userId, ana.userId));
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('failed');
  });

  it('says store purchases are off when the connector cannot check them', async () => {
    const plain = createFakePaymentConnector();
    setPaymentConnector(plain.connector);

    const { status } = await relay(ana, purchase());

    expect(status).toBe(404);
  });

  it('refuses a proven lie and an unsigned person', async () => {
    const { status: bad } = await relay(ana, purchase({ purchaseToken: '' }));
    expect(bad).toBe(400);

    const { status: anon } = await relay(null, purchase());
    expect(anon).toBe(401);
  });

  it('reuses the open native attempt when a store purchase is relayed again', async () => {
    const first = await relay(ana, purchase());
    const second = await relay(ana, purchase());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const [askedFirst] = fake.verifyPlayPurchase.mock.calls[0];
    const [askedSecond] = fake.verifyPlayPurchase.mock.calls[1];
    expect(askedSecond.checkoutId).toBe(askedFirst.checkoutId);
    const attempts = await db
      .select()
      .from(paymentCheckouts)
      .where(eq(paymentCheckouts.userId, ana.userId));
    expect(attempts).toHaveLength(1);
  });

  it('refuses a token another account relayed first', async () => {
    const xuxu = await registerUser('xuxu');
    await db.insert(playPurchaseClaims).values({
      purchaseTokenHash: hashPurchaseToken('token-abc'),
      userId: xuxu.userId,
      productId: 'plus_monthly',
    });

    const { status } = await relay(ana, purchase());

    expect(status).toBe(403);
    expect(fake.verifyPlayPurchase).not.toHaveBeenCalled();
  });

  it('refuses a sixth store purchase check within a minute', async () => {
    // A fresh person, so earlier tests in this file cannot have spent the per-minute window.
    const bia = await registerUser('bia');
    for (let index = 0; index < 5; index += 1) {
      const { status } = await relay(bia, purchase({ purchaseToken: `token-${index}` }));
      expect(status).toBe(200);
    }

    const { status } = await relay(bia, purchase({ purchaseToken: 'token-last' }));
    expect(status).toBe(429);
    // The refused call never reaches the store.
    expect(fake.verifyPlayPurchase).toHaveBeenCalledTimes(5);
  });

  it('relays a store purchase retry past the hourly web quota', async () => {
    await db.insert(paymentCheckouts).values(
      Array.from({ length: 10 }, (_, index) => ({
        id: `${newId()}${index}`,
        userId: ana.userId,
        tierId: proId,
        tierName: 'Pro',
        interval: 'monthly' as const,
        amountCents: 1990,
        currency: 'BRL',
        methodId: 'card',
        status: 'pending' as const,
        providerId: 'fake',
      })),
    );

    const { status, data } = await relay(ana, purchase());

    expect(status).toBe(200);
    expect(data.active).toBe(true);
  });

  it('opens a native attempt with no provider page', async () => {
    const { status, data } = await request('POST', '/payments/checkout', {
      token: ana.token,
      body: { tierId: proId, interval: 'monthly', methodId: 'playbilling' },
    });

    expect(status).toBe(201);
    expect(data.action).toEqual({ kind: 'none' });
    expect(data.methodId).toBe('playbilling');
  });
});

describe('a subscription bought in the store', () => {
  const storeMethods = [
    { id: 'playbilling', label: 'Google Play', flow: 'native', store: 'play' },
  ] as const;

  function connectorWithCancel() {
    const cancellable = createFakePaymentConnector({
      withCancel: true,
      methods: [...storeMethods],
      verifyPlay: async (verified) => {
        await postEvents([
          {
            type: 'payment.succeeded',
            eventId: `evt_${verified.checkoutId}`,
            checkoutId: verified.checkoutId,
            subscriptionReference: verified.purchaseToken,
            paidAt: new Date().toISOString(),
            amountCents: verified.amountCents,
            currency: verified.currency,
          },
        ]);
        return { active: true, orderId: 'GPA.1234' };
      },
    });
    setPaymentConnector(cancellable.connector);
    return cancellable;
  }

  it('is stopped in the store through the connector, and only then marked as ending', async () => {
    const cancellable = connectorWithCancel();
    await relay(ana, purchase());

    const info = await request('GET', '/payments', { token: ana.token });
    expect(info.data.subscription).toMatchObject({
      status: 'active',
      canCancelHere: true,
      autoRenews: true,
    });

    const { status, data } = await request('POST', '/payments/subscription/cancel', {
      token: ana.token,
    });

    expect(status).toBe(200);
    expect(data.cancelAtPeriodEnd).toBe(true);
    expect(cancellable.cancelSubscription).toHaveBeenCalledWith('token-abc');
  });

  it('is not marked as ending when the store could not be told: Google would keep charging', async () => {
    const cancellable = connectorWithCancel();
    await relay(ana, purchase());
    cancellable.cancelSubscription.mockRejectedValueOnce(new ConnectorError('down', 'timeout'));

    const { status } = await request('POST', '/payments/subscription/cancel', { token: ana.token });

    expect(status).toBe(502);
    const [row] = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.userId, ana.userId));
    expect(row.cancelAtPeriodEnd).toBe(false);
  });

  it('is left to the person when the connector cannot reach the store (it answers 400)', async () => {
    const cancellable = connectorWithCancel();
    await relay(ana, purchase());
    cancellable.cancelSubscription.mockRejectedValueOnce(
      new ConnectorError('Cancellation is not supported for this subscription.', 'status', 400),
    );

    const { status } = await request('POST', '/payments/subscription/cancel', { token: ana.token });

    expect(status).toBe(409);
    // What flags it then is the store saying the person stopped it there.
    await postEvents([
      {
        type: 'subscription.canceled',
        eventId: 'evt_store_cancel',
        subscriptionReference: 'token-abc',
      },
    ]);
    const [after] = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.userId, ana.userId));
    expect(after.cancelAtPeriodEnd).toBe(true);
  });

  it('is granted with a long purchase token: the reference is not cut at the length of other ids', async () => {
    const token = `ofbcjdkhgcdjliaejnmcjhki.${'AO-J1Oy'.repeat(80)}`;
    expect(token.length).toBeGreaterThan(200);

    const { status, data } = await relay(ana, purchase({ purchaseToken: token }));

    expect(status).toBe(200);
    expect(data.subscription).toMatchObject({ status: 'active', tierId: proId });
    const [row] = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.userId, ana.userId));
    expect(row.providerReference).toBe(token);
  });

  it("is renewed by the store's own notice, with no app open", async () => {
    await relay(ana, purchase());
    const [before] = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.userId, ana.userId));

    await postEvents([
      {
        type: 'payment.succeeded',
        eventId: 'GPA.1234..1',
        subscriptionReference: 'token-abc',
        paidAt: new Date(before.paidUntil.getTime() + 1000).toISOString(),
        amountCents: 1990,
        currency: 'BRL',
      },
    ]);

    const [after] = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.userId, ana.userId));
    expect(after.paidUntil.getTime()).toBeGreaterThan(before.paidUntil.getTime());
    expect(after.status).toBe('active');
  });
});
