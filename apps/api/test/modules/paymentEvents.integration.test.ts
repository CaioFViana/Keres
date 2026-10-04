import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  auditEvents,
  paymentEvents,
  paymentSubscriptions,
  playPurchaseClaims,
  tiers,
} from '../../src/db/schema';
import { setPaymentConnector } from '../../src/services/payments/PaymentConnectorRegistry';
import { hashPurchaseToken } from '../../src/services/payments/playPurchaseClaims';
import {
  HEADER_NONCE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  MAX_CLOCK_SKEW_SECONDS,
  verifyResponse,
} from '../../src/services/payments/connector/signing';
import { auditService } from '../../src/services/AuditService';
import { newId, registerUser, request, type TestUser } from '../helpers/app';
import { truncateAll } from '../helpers/database';
import { createFakePaymentConnector } from '../helpers/fakePaymentConnector';
import {
  CONNECTOR_SECRET,
  EVENTS_SECRET,
  postEvents,
  sendEvents,
  signEvents,
} from '../helpers/paymentEvents';

/**
 * The only door a payment connector comes in by is `POST /api/payments/events`, and it is open to the internet. What
 * is let through is what proves itself - by a signature that covers the direction, the method, the path, the time,
 * a one-time nonce and the body, made with a key kept for this direction alone - and nothing else. Every way a
 * request can fail to prove itself is here, and each leaves the payments exactly as they were.
 */
let ana: TestUser;
let proId: string;

const succeeded = (over: Record<string, unknown> = {}) => ({
  type: 'payment.succeeded',
  eventId: `evt_${newId()}`,
  paidAt: new Date().toISOString(),
  amountCents: 1990,
  currency: 'BRL',
  ...over,
});

async function openCheckout() {
  const { status, data } = await request('POST', '/payments/checkout', {
    token: ana.token,
    body: { tierId: proId, interval: 'monthly', methodId: 'card' },
  });
  expect(status).toBe(201);
  return data as { id: string };
}

const untouched = async () => {
  expect(await db.select().from(paymentSubscriptions)).toHaveLength(0);
  expect(await db.select().from(paymentEvents)).toHaveLength(0);
};

beforeEach(async () => {
  await truncateAll();
  setPaymentConnector(createFakePaymentConnector().connector);
  ana = await registerUser('ana');
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

describe('a request that proves itself', () => {
  it('is applied, and answered with what was received and what changed', async () => {
    const mine = await openCheckout();

    const { status, data } = await postEvents([
      succeeded({ checkoutId: mine.id, subscriptionReference: 'sub_ana' }),
    ]);

    expect(status).toBe(200);
    expect(data).toEqual({ received: 1, applied: 1 });
    expect((await db.select().from(paymentSubscriptions))[0]).toMatchObject({
      userId: ana.userId,
      status: 'active',
    });
  });

  it('refuses a grant for a store token another account claimed first', async () => {
    const xuxu = await registerUser('xuxu');
    await db.insert(playPurchaseClaims).values({
      purchaseTokenHash: hashPurchaseToken('token-abc'),
      userId: xuxu.userId,
      productId: 'plus_monthly',
    });
    const mine = await openCheckout();

    const { status, data } = await postEvents([
      succeeded({ checkoutId: mine.id, subscriptionReference: 'token-abc' }),
    ]);

    expect(status).toBe(200);
    expect(data).toEqual({ received: 1, applied: 0 });
    expect(await db.select().from(paymentSubscriptions)).toHaveLength(0);
  });

  it('may carry several events, and none', async () => {
    const mine = await openCheckout();

    expect(
      (
        await postEvents([
          succeeded({ checkoutId: mine.id, subscriptionReference: 'sub_ana' }),
          { type: 'payment.failed', eventId: 'evt_f', subscriptionReference: 'sub_ana' },
        ])
      ).data,
    ).toEqual({ received: 2, applied: 2 });
    expect((await postEvents([])).data).toEqual({ received: 0, applied: 0 });
  });

  it('is answered with a signature of the server’s own, for that request and no other', async () => {
    const { status, headers, text, nonce } = await postEvents([]);

    expect(status).toBe(200);
    const verdict = verifyResponse({
      requestNonce: nonce,
      status,
      headers: {
        [HEADER_TIMESTAMP]: headers.get(HEADER_TIMESTAMP) ?? undefined,
        [HEADER_SIGNATURE]: headers.get(HEADER_SIGNATURE) ?? undefined,
      },
      body: text,
      secrets: [EVENTS_SECRET],
    });
    expect(verdict).toEqual({ ok: true });
    // It does not stand for an answer to another request.
    expect(
      verifyResponse({
        requestNonce: 'N'.repeat(24),
        status,
        headers: {
          [HEADER_TIMESTAMP]: headers.get(HEADER_TIMESTAMP) ?? undefined,
          [HEADER_SIGNATURE]: headers.get(HEADER_SIGNATURE) ?? undefined,
        },
        body: text,
        secrets: [EVENTS_SECRET],
      }),
    ).toEqual({ ok: false, reason: 'signature' });
  });

  it('accepts the same fact again as the connector retries: it counts once', async () => {
    const mine = await openCheckout();
    const event = succeeded({
      eventId: 'evt_once',
      checkoutId: mine.id,
      subscriptionReference: 'sub_ana',
    });

    expect((await postEvents([event])).data).toEqual({ received: 1, applied: 1 });
    // A new request (a new nonce) with the same event id: not a replay of a message, a retry of a fact.
    expect((await postEvents([event])).data).toEqual({ received: 1, applied: 0 });
    expect(await db.select().from(paymentEvents)).toHaveLength(1);
  });
});

describe('a request that does not prove itself', () => {
  const refused = async (response: Promise<{ status: number; data: any }>) => {
    const { status, data } = await response;
    expect(status).toBe(401);
    // The same words whatever was wrong: a caller who is not the connector learns nothing from them.
    expect(data).toEqual({ message: 'Request rejected.' });
    await untouched();
  };

  it('is refused with no signature at all, or with part of one', async () => {
    const mine = await openCheckout();
    const events = [succeeded({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })];

    await refused(
      sendEvents({
        body: JSON.stringify({ events }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    for (const name of [HEADER_TIMESTAMP, HEADER_NONCE, HEADER_SIGNATURE]) {
      await refused(postEvents(events, { headers: { [name]: undefined } }));
    }
  });

  it('is refused when it is signed with a key the server does not know', async () => {
    const mine = await openCheckout();

    await refused(
      postEvents([succeeded({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })], {
        forged: true,
      }),
    );
  });

  it('is refused when it is signed with the key of the other direction: the key that signs the server’s own requests is no key to this door', async () => {
    const mine = await openCheckout();

    await refused(
      postEvents([succeeded({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })], {
        secret: CONNECTOR_SECRET,
      }),
    );
  });

  it('is refused when it was signed as a request of the other direction, whatever the key', async () => {
    const mine = await openCheckout();

    await refused(
      postEvents([succeeded({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })], {
        direction: 'keres-to-connector',
      }),
    );
  });

  it('is refused when the body is not the one that was signed', async () => {
    const mine = await openCheckout();
    const signedFor = JSON.stringify({ events: [] });
    const sent = JSON.stringify({
      events: [succeeded({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })],
    });

    await refused(postEvents([], { rawBody: sent, signedBody: signedFor }));
  });

  it.each([
    ['too old', -(MAX_CLOCK_SKEW_SECONDS + 5) * 1000],
    ['from the future', (MAX_CLOCK_SKEW_SECONDS + 5) * 1000],
  ])('is refused when its time is %s, though everything else is right', async (_label, offset) => {
    const mine = await openCheckout();

    await refused(
      postEvents([succeeded({ checkoutId: mine.id, subscriptionReference: 'sub_ana' })], {
        at: Date.now() + offset,
      }),
    );
  });

  it.each([
    ['a timestamp that is not a number', { [HEADER_TIMESTAMP]: 'now' }],
    ['a nonce that is too short', { [HEADER_NONCE]: 'abc' }],
    ['a signature of another version', { [HEADER_SIGNATURE]: 'v2=' + '0'.repeat(64) }],
  ])('is refused with %s', async (_label, headers) => {
    await refused(postEvents([], { headers }));
  });

  it('is refused the second time when it is sent twice, the way a message that was recorded on the way is replayed', async () => {
    const mine = await openCheckout();
    const message = signEvents([
      succeeded({ checkoutId: mine.id, subscriptionReference: 'sub_ana' }),
    ]);

    expect((await sendEvents(message)).status).toBe(200);
    const replay = await sendEvents(message);

    expect(replay.status).toBe(401);
    expect(replay.data).toEqual({ message: 'Request rejected.' });
    // What the first one did is done once.
    expect(await db.select().from(paymentSubscriptions)).toHaveLength(1);
  });

  it('is told apart from one that failed only for what was wrong with its signature: a wrong one does not use up a nonce', async () => {
    const message = signEvents([]);

    const tampered = await sendEvents({
      body: message.body,
      headers: { ...message.headers, [HEADER_SIGNATURE]: 'v1=' + '0'.repeat(64) },
    });
    const real = await sendEvents(message);

    expect(tampered.status).toBe(401);
    expect(real.status).toBe(200);
  });

  it('is written in the activity record as a failure, without saying what was in it', async () => {
    await postEvents([succeeded({ eventId: 'evt_secret_looking' })], { forged: true });
    await auditService.recordNow({ category: 'system', action: 'system.flush' });

    const rows = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, 'payment.events_rejected'));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((row) => row.outcome === 'failure')).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('evt_secret_looking');
  });
});

describe('a request that proves itself but is not what the contract says', () => {
  const invalid = async (events: Record<string, unknown>[] | string, expected?: RegExp) => {
    const { status, data } =
      typeof events === 'string'
        ? await postEvents([], { rawBody: events })
        : await postEvents(events);
    expect(status).toBe(400);
    if (expected) expect(data.message).toMatch(expected);
    await untouched();
  };

  it('is refused when the body is not JSON, or is not an object with events', async () => {
    await invalid('not json', /not JSON/);
    await invalid('{}', /events/);
    await invalid('{"events":"nope"}', /events/);
    await invalid('[]');
  });

  it.each([
    ['an event of a kind that is not in the contract', { type: 'payment.refunded', eventId: 'e' }],
    [
      'a payment with no date',
      { type: 'payment.succeeded', eventId: 'e', amountCents: 1, currency: 'BRL' },
    ],
    ['a payment with a date that is not one', succeeded({ paidAt: 'yesterday' })],
    ['a payment with an amount that is negative', succeeded({ amountCents: -1 })],
    ['a payment with an amount that is not whole', succeeded({ amountCents: 19.9 })],
    ['a payment with a currency that is not three letters', succeeded({ currency: 'REAL' })],
    ['an event with no id', { type: 'checkout.expired', checkoutId: 'c' }],
    ['an event with an id that is far too long', succeeded({ eventId: 'e'.repeat(201) })],
    ['a cancellation with no subscription', { type: 'subscription.canceled', eventId: 'e' }],
    ['an expiry with no attempt', { type: 'checkout.expired', eventId: 'e' }],
  ])('is refused with %s', async (_label, event) => {
    await invalid([event as Record<string, unknown>]);
  });

  it('is refused with more events than a request may carry', async () => {
    await invalid(
      Array.from({ length: 101 }, (_, index) => ({
        type: 'payment.failed',
        eventId: `evt_${index}`,
      })),
      /events/,
    );
  });

  it('is refused when it weighs more than a batch of events ever does, before anything is read of it', async () => {
    const huge = JSON.stringify({ events: [], padding: 'x'.repeat(300 * 1024) });

    const { status } = await postEvents([], { rawBody: huge });

    expect(status).toBe(413);
    await untouched();
  });
});

describe('a server with no connector', () => {
  it('does not answer there, however well signed the request is', async () => {
    setPaymentConnector(null);

    const { status } = await postEvents([]);

    expect(status).toBe(404);
  });
});
