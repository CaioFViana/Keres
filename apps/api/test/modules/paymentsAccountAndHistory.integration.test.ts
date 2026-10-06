import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import { paymentEvents, paymentSubscriptions, tiers, users } from '../../src/db/schema';
import { setPaymentConnector } from '../../src/services/payments/PaymentConnectorRegistry';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { promoteToAdmin, truncateAll } from '../helpers/database';
import { createFakePaymentConnector } from '../helpers/fakePaymentConnector';
import { ConnectorError } from '../../src/services/payments/connector/signedClient';
import { postEvents } from '../helpers/paymentEvents';

/**
 * Two things a person's account has to do with its payments: closing the account must stop what would charge it
 * again, and the person can read their own payment history - with this server's ids, never the provider's.
 */
let admin: TestUser;
let ana: TestUser;
let bia: TestUser;
let proId: string;
let fake: ReturnType<typeof createFakePaymentConnector>;

const paid = (over: Record<string, unknown>) => ({
  type: 'payment.succeeded',
  eventId: `evt_${newId()}`,
  paidAt: new Date().toISOString(),
  amountCents: 1990,
  currency: 'BRL',
  ...over,
});

async function subscribe(user: TestUser, reference: string) {
  const { data } = await request('POST', '/payments/checkout', {
    token: user.token,
    body: { tierId: proId, interval: 'monthly', methodId: 'card' },
  });
  await postEvents([
    paid({ checkoutId: (data as { id: string }).id, subscriptionReference: reference }),
  ]);
}

const closeAccount = (user: TestUser) =>
  request('DELETE', `/admin/api/users/${user.userId}`, { token: admin.token });

const subscriptionOf = async (user: TestUser) =>
  (
    await db.select().from(paymentSubscriptions).where(eq(paymentSubscriptions.userId, user.userId))
  )[0];

const accountOf = async (user: TestUser) =>
  (await db.select().from(users).where(eq(users.id, user.userId)))[0];

beforeEach(async () => {
  await truncateAll();
  fake = createFakePaymentConnector({ withCancel: true });
  setPaymentConnector(fake.connector);
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

describe('closing an account that is being charged', () => {
  it('stops the renewal at the provider, and keeps what was paid until its period ends', async () => {
    await subscribe(ana, 'sub_ana');

    const { status } = await closeAccount(ana);

    expect(status).toBe(200);
    expect(fake.cancelSubscription).toHaveBeenCalledWith('sub_ana');
    expect((await accountOf(ana)).isDeleted).toBe(true);
    expect(await subscriptionOf(ana)).toMatchObject({ status: 'active', cancelAtPeriodEnd: true });
    const lines = await db.select().from(paymentEvents).where(eq(paymentEvents.userId, ana.userId));
    expect(
      lines.some(
        (line) => line.kind === 'subscription_canceled' && line.detail?.includes('closed'),
      ),
    ).toBe(true);
  });

  it('leaves the account open, and says why, when the provider cannot be told to stop', async () => {
    await subscribe(ana, 'sub_ana');
    fake.state.cancelFails = true;

    const { status, data } = await closeAccount(ana);

    expect(status).toBe(502);
    expect(String((data as { message?: string }).message)).toContain('not closed');
    expect((await accountOf(ana)).isDeleted).toBe(false);
    expect((await subscriptionOf(ana)).cancelAtPeriodEnd).toBe(false);

    // Once the provider answers again, the same action goes through.
    fake.state.cancelFails = false;
    expect((await closeAccount(ana)).status).toBe(200);
    expect((await accountOf(ana)).isDeleted).toBe(true);
  });

  it('leaves the account open while the connector is not there to stop the subscription', async () => {
    await subscribe(ana, 'sub_ana');
    setPaymentConnector(null);

    const { status } = await closeAccount(ana);

    expect(status).toBe(502);
    expect((await accountOf(ana)).isDeleted).toBe(false);
  });

  it('does not call the provider again for a renewal that was already stopped', async () => {
    await subscribe(ana, 'sub_ana');
    await request('POST', '/payments/subscription/cancel', { token: ana.token });
    fake.cancelSubscription.mockClear();

    expect((await closeAccount(ana)).status).toBe(200);

    expect(fake.cancelSubscription).not.toHaveBeenCalled();
  });

  it('also stops one that is already late, since the provider may still try to charge it', async () => {
    await subscribe(ana, 'sub_ana');
    await db
      .update(paymentSubscriptions)
      .set({ status: 'due' })
      .where(eq(paymentSubscriptions.userId, ana.userId));

    expect((await closeAccount(ana)).status).toBe(200);

    expect(fake.cancelSubscription).toHaveBeenCalledWith('sub_ana');
    expect((await subscriptionOf(ana)).status).toBe('canceled');
  });

  it('closes an account that has nothing to stop, with or without a connector', async () => {
    expect((await closeAccount(bia)).status).toBe(200);
    expect(fake.cancelSubscription).not.toHaveBeenCalled();
  });

  it('stops a subscription bought in the store at the store, through the connector', async () => {
    fake = createFakePaymentConnector({
      withCancel: true,
      methods: [{ id: 'playbilling', label: 'Google Play', flow: 'native', store: 'play' }],
    });
    setPaymentConnector(fake.connector);
    const { data } = await request('POST', '/payments/checkout', {
      token: ana.token,
      body: { tierId: proId, interval: 'monthly', methodId: 'playbilling' },
    });
    await postEvents([
      paid({ checkoutId: (data as { id: string }).id, subscriptionReference: 'play-token-ana' }),
    ]);

    expect((await closeAccount(ana)).status).toBe(200);

    expect(fake.cancelSubscription).toHaveBeenCalledWith('play-token-ana');
    expect((await subscriptionOf(ana)).cancelAtPeriodEnd).toBe(true);
    expect((await accountOf(ana)).isDeleted).toBe(true);
  });

  it('only notes a store subscription when the connector cannot reach the store: the person cancels it there', async () => {
    fake = createFakePaymentConnector({
      withCancel: true,
      methods: [{ id: 'playbilling', label: 'Google Play', flow: 'native', store: 'play' }],
    });
    setPaymentConnector(fake.connector);
    fake.cancelSubscription.mockRejectedValueOnce(
      new ConnectorError('Cancellation is not supported.', 'status', 400),
    );
    const { data } = await request('POST', '/payments/checkout', {
      token: ana.token,
      body: { tierId: proId, interval: 'monthly', methodId: 'playbilling' },
    });
    await postEvents([
      paid({ checkoutId: (data as { id: string }).id, subscriptionReference: 'play-token-ana' }),
    ]);

    expect((await closeAccount(ana)).status).toBe(200);

    const lines = await db.select().from(paymentEvents).where(eq(paymentEvents.userId, ana.userId));
    expect(lines.some((line) => line.detail?.includes('cancelled there'))).toBe(true);
    expect((await accountOf(ana)).isDeleted).toBe(true);
  });

  it('still refuses to close the account when the store cannot be told for any other reason', async () => {
    fake = createFakePaymentConnector({
      withCancel: true,
      methods: [{ id: 'playbilling', label: 'Google Play', flow: 'native', store: 'play' }],
    });
    setPaymentConnector(fake.connector);
    fake.cancelSubscription.mockRejectedValueOnce(new ConnectorError('down', 'timeout'));
    const { data } = await request('POST', '/payments/checkout', {
      token: ana.token,
      body: { tierId: proId, interval: 'monthly', methodId: 'playbilling' },
    });
    await postEvents([
      paid({ checkoutId: (data as { id: string }).id, subscriptionReference: 'play-token-ana' }),
    ]);

    expect((await closeAccount(ana)).status).toBe(502);
    expect((await accountOf(ana)).isDeleted).toBe(false);
  });
});

describe('the payment history of a person', () => {
  const history = (user: TestUser | null, query: Record<string, string> = {}) =>
    request('GET', '/payments/history', user ? { token: user.token, query } : { query });

  it("lists what the person paid, newest first, with this server's ids and nothing of the provider's", async () => {
    await subscribe(ana, 'sub_secret_reference');
    await postEvents([paid({ subscriptionReference: 'sub_secret_reference', amountCents: 2490 })]);

    const { status, data } = await history(ana);

    expect(status).toBe(200);
    expect(data.items).toHaveLength(2);
    expect(data.items[0]).toMatchObject({
      kind: 'payment_succeeded',
      tierName: 'Pro',
      amountCents: 2490,
      currency: 'BRL',
    });
    expect(data.items[0].createdAt >= data.items[1].createdAt).toBe(true);
    expect(data.nextBefore).toBeNull();
    expect(Object.keys(data.items[0]).sort()).toEqual(
      ['amountCents', 'createdAt', 'currency', 'id', 'kind', 'tierName'].sort(),
    );
    expect(JSON.stringify(data)).not.toContain('sub_secret_reference');
  });

  it("is the person's own: nobody else's payments, nobody signed out", async () => {
    await subscribe(ana, 'sub_ana');

    expect((await history(bia)).data.items).toEqual([]);
    expect((await history(null)).status).toBe(401);
  });

  it('shows a plan given by an administrator and a payment that failed, but not what is not a payment', async () => {
    await subscribe(ana, 'sub_ana');
    await request('POST', `/admin/api/payments/users/${ana.userId}/gift`, {
      token: admin.token,
      body: { tierId: proId, months: 2 },
    });
    await postEvents([
      {
        type: 'payment.failed',
        eventId: `evt_${newId()}`,
        subscriptionReference: 'sub_ana',
        reason: 'Card declined',
      },
    ]);
    await request('POST', '/payments/subscription/cancel', { token: ana.token });

    const kinds = (await history(ana)).data.items.map((item: { kind: string }) => item.kind);

    expect(kinds).toContain('gift_granted');
    expect(kinds).toContain('payment_failed');
    expect(kinds.filter((kind: string) => kind === 'payment_succeeded')).toHaveLength(1);
    // The stopped renewal is on the ledger, but it is not a payment.
    expect(kinds).not.toContain('subscription_canceled');
  });

  it('leaves out a payment the server turned down', async () => {
    await subscribe(ana, 'sub_ana');
    await db.insert(paymentEvents).values({
      id: newId(),
      providerId: 'fakepay',
      kind: 'payment_succeeded',
      userId: ana.userId,
      tierName: 'Pro',
      amountCents: 1990,
      currency: 'BRL',
      detail: 'Refused: the purchase token belongs to another account.',
    });

    expect((await history(ana)).data.items).toHaveLength(1);
  });

  it('pages, newest first, without repeating or skipping', async () => {
    await subscribe(ana, 'sub_ana');
    for (let index = 0; index < 4; index += 1) {
      await postEvents([paid({ subscriptionReference: 'sub_ana', amountCents: 2000 + index })]);
    }

    const first = (await history(ana, { limit: '2' })).data;
    expect(first.items).toHaveLength(2);
    expect(first.nextBefore).toBe(first.items[1].id);
    const second = (await history(ana, { limit: '2', before: first.nextBefore })).data;
    const third = (await history(ana, { limit: '2', before: second.nextBefore })).data;

    const ids = [...first.items, ...second.items, ...third.items].map(
      (item: { id: string }) => item.id,
    );
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect([...ids].sort().reverse()).toEqual(ids);
    expect(third.nextBefore).toBeNull();
  });

  it('refuses a page size outside what is allowed', async () => {
    expect((await history(ana, { limit: '0' })).status).toBe(400);
    expect((await history(ana, { limit: '101' })).status).toBe(400);
  });

  it('answers even when this server sells nothing: a plan given by hand has a history too', async () => {
    await request('POST', `/admin/api/payments/users/${bia.userId}/gift`, {
      token: admin.token,
      body: { tierId: proId, months: 1 },
    });
    setPaymentConnector(null);

    const { status, data } = await history(bia);

    expect(status).toBe(200);
    expect(data.items.map((item: { kind: string }) => item.kind)).toEqual(['gift_granted']);
  });
});
