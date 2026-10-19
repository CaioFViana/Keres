import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { canonicalRequest, sign } from '../src/protocol/signing';
import { createPayPalProvider } from '../src/providers/paypal';
import { createStripeProvider } from '../src/providers/stripe';
import { CheckoutStore, type ProviderContext } from '../src/providers/types';
import { createApp, createState } from '../src/routes';

/**
 * The safety net: Keres asks what the provider charged a subscription since a date, and gets the same events
 * (same ids) the webhooks would have carried - so a notice that never came is found, and one that did is not
 * counted twice.
 */

const CONNECTOR_SECRET = 'connector-secret-0123456789abcdef';

function config() {
  return loadConfig({
    KERES_CONNECTOR_SECRET: CONNECTOR_SECRET,
    KERES_BASE_URL: 'http://127.0.0.1:3000',
    KERES_EVENTS_SECRET: 'events-secret-0123456789abcdef-00',
    PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
    PAYPAL_CLIENT_ID: 'client-id',
    PAYPAL_SECRET: 'paypal-secret',
    PAYPAL_WEBHOOK_ID: 'webhook-id',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test-0123456789abcdef-test',
  } as NodeJS.ProcessEnv);
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const since = new Date('2026-09-01T00:00:00.000Z');

function context(fetchImpl: typeof fetch): ProviderContext {
  return { config: config(), store: new CheckoutStore(), fetchImpl, report: vi.fn() };
}

function paypalSays(
  subscription: Record<string, unknown>,
  transactions: unknown[] | number,
  seen: string[] = [],
): typeof fetch {
  return (async (input: string | URL | Request) => {
    const address = String(input);
    seen.push(address);
    if (address.endsWith('/v1/oauth2/token'))
      return json({ access_token: 'tok', expires_in: 3600 });
    if (address.includes('/transactions?')) {
      return typeof transactions === 'number' ? json({}, transactions) : json({ transactions });
    }
    return json(subscription);
  }) as typeof fetch;
}

const sale = (id: string, time: string, value = '25.00', over: Record<string, unknown> = {}) => ({
  id,
  status: 'COMPLETED',
  amount_with_breakdown: { gross_amount: { value, currency_code: 'BRL' } },
  time,
  ...over,
});

describe('PayPal: what a subscription was charged since a date', () => {
  it('lists each completed charge under the id its webhook carries, oldest first, naming the attempt', async () => {
    const seen: string[] = [];
    const events = await createPayPalProvider().listSubscriptionEvents?.(
      'I-1',
      since,
      context(
        paypalSays(
          { id: 'I-1', status: 'ACTIVE', custom_id: 'checkout-1' },
          [
            sale('SALE-2', '2026-10-04T12:00:00Z', '30.00'),
            sale('SALE-1', '2026-09-04T12:00:00Z'),
            sale('SALE-X', '2026-09-20T12:00:00Z', '25.00', { status: 'DECLINED' }),
          ],
          seen,
        ),
      ),
    );

    expect(events).toEqual([
      {
        type: 'payment.succeeded',
        eventId: 'SALE-1',
        checkoutId: 'checkout-1',
        subscriptionReference: 'I-1',
        paidAt: '2026-09-04T12:00:00Z',
        amountCents: 2500,
        currency: 'BRL',
      },
      expect.objectContaining({ eventId: 'SALE-2', amountCents: 3000 }),
    ]);
    // The window the provider is asked about starts where Keres said.
    expect(seen.find((address) => address.includes('/transactions?'))).toContain(
      encodeURIComponent(since.toISOString()),
    );
  });

  it('adds the end of a subscription PayPal says is over', async () => {
    const events = await createPayPalProvider().listSubscriptionEvents?.(
      'I-1',
      since,
      context(
        paypalSays({ id: 'I-1', status: 'CANCELLED' }, [sale('SALE-1', '2026-09-04T12:00:00Z')]),
      ),
    );

    expect(events?.map((event) => event.type)).toEqual([
      'payment.succeeded',
      'subscription.canceled',
    ]);
    expect(events?.at(-1)).toMatchObject({
      eventId: 'paypal-cancel-I-1',
      subscriptionReference: 'I-1',
    });
  });

  it('is empty when nothing was charged, and fails (never invents) when PayPal does not answer', async () => {
    const provider = createPayPalProvider();
    expect(
      await provider.listSubscriptionEvents?.(
        'I-1',
        since,
        context(paypalSays({ status: 'ACTIVE' }, [])),
      ),
    ).toEqual([]);
    await expect(
      provider.listSubscriptionEvents?.(
        'I-1',
        since,
        context(paypalSays({ status: 'ACTIVE' }, 500)),
      ),
    ).rejects.toThrow('could not list');
    await expect(
      provider.listSubscriptionEvents?.(
        'I-1',
        since,
        context((async (input: string | URL | Request) =>
          String(input).endsWith('/v1/oauth2/token')
            ? json({ access_token: 'tok', expires_in: 3600 })
            : json({}, 404)) as typeof fetch),
      ),
    ).rejects.toThrow('could not read');
  });
});

describe('Stripe: what a subscription was charged since a date', () => {
  function stripeSays(
    invoices: unknown[] | number,
    subscription: Record<string, unknown>,
    seen: string[] = [],
  ) {
    return (async (input: string | URL | Request) => {
      const address = String(input);
      seen.push(address);
      if (address.includes('/v1/invoices')) {
        return typeof invoices === 'number' ? json({}, invoices) : json({ data: invoices });
      }
      return json(subscription);
    }) as typeof fetch;
  }
  const invoice = (id: string, paidAt: number, amount = 2500) => ({
    id,
    amount_paid: amount,
    currency: 'brl',
    created: paidAt - 60,
    status_transitions: { paid_at: paidAt },
  });

  it('lists each paid invoice under the id its webhook carries, oldest first', async () => {
    const seen: string[] = [];
    const events = await createStripeProvider().listSubscriptionEvents?.(
      'sub_1',
      since,
      context(
        stripeSays(
          [invoice('in_2', 1_790_000_000, 3000), invoice('in_1', 1_787_000_000)],
          { id: 'sub_1', status: 'active' },
          seen,
        ),
      ),
    );

    expect(events).toEqual([
      {
        type: 'payment.succeeded',
        eventId: 'stripe-invoice-in_1',
        subscriptionReference: 'sub_1',
        paidAt: new Date(1_787_000_000 * 1000).toISOString(),
        amountCents: 2500,
        currency: 'BRL',
      },
      expect.objectContaining({ eventId: 'stripe-invoice-in_2', amountCents: 3000 }),
    ]);
    const asked = new URL(seen.find((address) => address.includes('/v1/invoices')) as string);
    expect(asked.searchParams.get('subscription')).toBe('sub_1');
    expect(asked.searchParams.get('status')).toBe('paid');
    expect(asked.searchParams.get('created[gte]')).toBe(String(Math.floor(since.getTime() / 1000)));
  });

  it('adds the end of a subscription Stripe says is cancelled', async () => {
    const events = await createStripeProvider().listSubscriptionEvents?.(
      'sub_1',
      since,
      context(stripeSays([], { id: 'sub_1', status: 'canceled' })),
    );

    expect(events).toEqual([
      {
        type: 'subscription.canceled',
        eventId: 'stripe-cancel-sub_1',
        subscriptionReference: 'sub_1',
      },
    ]);
  });

  it('fails when Stripe does not answer', async () => {
    await expect(
      createStripeProvider().listSubscriptionEvents?.('sub_1', since, context(stripeSays(500, {}))),
    ).rejects.toThrow('could not list');
  });
});

describe('the connector route', () => {
  let counter = 0;
  function signedGet(app: { fetch: (request: Request) => Promise<Response> }, path: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = `reconcile-nonce-${(counter += 1)}-abcdefghij`;
    return app.fetch(
      new Request(`http://127.0.0.1:3101${path}`, {
        headers: {
          'x-keres-timestamp': String(timestamp),
          'x-keres-nonce': nonce,
          'x-keres-signature': sign(
            CONNECTOR_SECRET,
            canonicalRequest({ method: 'GET', path, timestamp, nonce, body: '' }),
          ),
        },
      }),
    );
  }
  const app = () =>
    createApp(
      createState(config(), {
        providers: [createPayPalProvider(), createStripeProvider()],
        fetchImpl: ((input: string | URL | Request) => {
          const address = String(input);
          if (address.endsWith('/v1/oauth2/token')) {
            return Promise.resolve(json({ access_token: 'tok', expires_in: 3600 }));
          }
          if (address.includes('paypal.com') && address.includes('/transactions?')) {
            return Promise.resolve(
              json({ transactions: [sale('SALE-1', '2026-09-04T12:00:00Z')] }),
            );
          }
          if (address.includes('paypal.com')) {
            return Promise.resolve(json({ id: 'I-1', status: 'ACTIVE' }));
          }
          return Promise.resolve(json({ data: [] }));
        }) as typeof fetch,
      }),
    );
  const path = (reference: string, sinceValue = since.toISOString()) =>
    `/v1/subscriptions/${encodeURIComponent(reference)}/events?since=${encodeURIComponent(sinceValue)}`;

  it('advertises the capability once a provider can do it', async () => {
    const info = await signedGet(app(), '/v1/info');

    expect(((await info.json()) as { capabilities: string[] }).capabilities).toContain('reconcile');
  });

  it('answers with the events of the provider that owns the reference', async () => {
    const response = await signedGet(app(), path('I-1'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      events: [expect.objectContaining({ eventId: 'SALE-1', subscriptionReference: 'I-1' })],
    });
  });

  it('answers with nothing for a reference nobody here owns (a store token), and refuses a date that is not one', async () => {
    const store = await signedGet(app(), path('ofbcjdkhgcdjliaejnmcjhki.AO-J1Oy'));
    expect(await store.json()).toEqual({ events: [] });

    expect((await signedGet(app(), path('I-1', 'yesterday'))).status).toBe(400);
  });

  it('turns a provider that fails into an error, not into "nothing was charged"', async () => {
    const failing = createApp(
      createState(config(), {
        providers: [createPayPalProvider()],
        fetchImpl: (async () => json({ message: 'down' }, 500)) as unknown as typeof fetch,
      }),
    );

    expect((await signedGet(failing, path('I-1'))).status).toBe(502);
  });
});
