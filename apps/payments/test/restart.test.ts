import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { canonicalRequest, sign } from '../src/protocol/signing';
import { createPayPalProvider } from '../src/providers/paypal';
import { createStripeProvider } from '../src/providers/stripe';
import { CheckoutStore } from '../src/providers/types';
import { createApp, createState } from '../src/routes';
import type { PaymentEventWire } from '../src/wire';

/**
 * This service keeps nothing on disk: what it remembers about an attempt (the map in memory) is gone when
 * it restarts. These tests start from that empty memory - a fresh state, as after a crash between the
 * person paying and the provider telling us - and check that every way a payment reaches Keres still
 * works from what the provider itself says.
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

/** A provider side that answers like the real ones for one finished payment each. */
function providersAnswering(calls: string[]): typeof fetch {
  return (async (input: string | URL | Request) => {
    const address = String(input);
    calls.push(address);
    if (address.endsWith('/v1/oauth2/token'))
      return json({ access_token: 'tok', expires_in: 3600 });
    if (address.includes('/v1/checkout/sessions/cs_1')) {
      return json({
        id: 'cs_1',
        status: 'complete',
        payment_status: 'paid',
        amount_total: 2500,
        currency: 'brl',
        subscription: 'sub_1',
        invoice: 'in_1',
        metadata: { checkoutId: 'checkout-9' },
        client_reference_id: 'checkout-9',
      });
    }
    if (address.includes('/transactions?')) {
      return json({
        transactions: [
          {
            id: 'SALE-1',
            amount_with_breakdown: { gross_amount: { value: '25.00', currency_code: 'BRL' } },
            time: '2026-10-04T12:00:00Z',
          },
        ],
      });
    }
    if (address.endsWith('/v1/billing/subscriptions/I-1')) {
      return json({ id: 'I-1', status: 'ACTIVE', custom_id: 'checkout-1' });
    }
    return json({ message: 'not found' }, 404);
  }) as typeof fetch;
}

function freshApp(calls: string[] = []) {
  const report = vi.fn(async (_events: PaymentEventWire[]) => undefined);
  const state = createState(config(), {
    providers: [createPayPalProvider(), createStripeProvider()],
    fetchImpl: providersAnswering(calls),
    report,
  });
  expect([...state.store.entries()]).toEqual([]); // nothing remembered
  return { app: createApp(state), report, calls };
}

let counter = 0;
function signedGet(app: { fetch: (request: Request) => Promise<Response> }, path: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = `restart-nonce-${(counter += 1)}-abcdefghij`;
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

describe('after a restart, with nothing remembered', () => {
  it('confirms a Stripe payment from the return page, naming the attempt the session carries', async () => {
    const { app, report } = freshApp();

    const response = await app.fetch(
      new Request('http://127.0.0.1:3101/v1/stripe/return?session_id=cs_1'),
    );

    expect(response.status).toBe(200);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        type: 'payment.succeeded',
        // The attempt, not the session id the old code fell back to.
        checkoutId: 'checkout-9',
        subscriptionReference: 'sub_1',
        eventId: 'stripe-invoice-in_1',
      }),
    ]);
  });

  it('confirms a PayPal payment from the return page, naming the attempt the subscription carries', async () => {
    const { app, report } = freshApp();

    const response = await app.fetch(
      new Request('http://127.0.0.1:3101/v1/paypal/return?subscription_id=I-1&token=EC-1'),
    );

    expect(response.status).toBe(200);
    expect(report.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        type: 'payment.succeeded',
        checkoutId: 'checkout-1',
        subscriptionReference: 'I-1',
        eventId: 'SALE-1',
      }),
    ]);
  });

  it("answers Keres's question about an attempt, asking only the provider that owns the reference", async () => {
    const calls: string[] = [];
    const { app } = freshApp(calls);

    const stripe = await signedGet(app, '/v1/checkouts/checkout-9?providerReference=cs_1');
    const body = (await stripe.json()) as { event: { checkoutId: string; type: string } };

    expect(stripe.status).toBe(200);
    expect(body.event).toMatchObject({ type: 'payment.succeeded', checkoutId: 'checkout-9' });
    // Stripe was asked; PayPal was not, nor its token endpoint.
    expect(calls.some((call) => call.includes('api.stripe.com'))).toBe(true);
    expect(calls.some((call) => call.includes('paypal.com'))).toBe(false);

    calls.length = 0;
    const paypal = await signedGet(app, '/v1/checkouts/checkout-1?providerReference=I-1');
    expect(((await paypal.json()) as { event: { eventId: string } }).event.eventId).toBe('SALE-1');
    expect(calls.some((call) => call.includes('api.stripe.com'))).toBe(false);
  });

  it('answers "not yet" for a reference nobody owns, without asking anyone', async () => {
    const calls: string[] = [];
    const { app } = freshApp(calls);

    const response = await signedGet(
      app,
      '/v1/checkouts/checkout-x?providerReference=something-else',
    );

    expect(await response.json()).toEqual({ event: null });
    expect(calls).toEqual([]);
  });

  it('does not need the memory to cancel: the reference says which provider holds the subscription', async () => {
    const calls: string[] = [];
    const { app } = freshApp(calls);
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/v1/subscriptions/sub_1/cancel';
    const nonce = `restart-cancel-${(counter += 1)}-abcdefghij`;

    const response = await app.fetch(
      new Request(`http://127.0.0.1:3101${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-keres-timestamp': String(timestamp),
          'x-keres-nonce': nonce,
          'x-keres-signature': sign(
            CONNECTOR_SECRET,
            canonicalRequest({ method: 'POST', path, timestamp, nonce, body: '{}' }),
          ),
        },
        body: '{}',
      }),
    );

    // Stripe answers 404 to this stand-in, so the cancel is refused - but it went to Stripe alone.
    expect(response.status).toBe(502);
    expect(calls.some((call) => call.includes('/v1/subscriptions/sub_1'))).toBe(true);
    expect(calls.some((call) => call.includes('paypal.com'))).toBe(false);
  });
});

describe('PayPal plans across a restart', () => {
  it("asks for the product and the plan under ids that name them, so a second process gets the first one's", async () => {
    const seen: Array<{ url: string; requestId: string | null }> = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const address = String(input);
      const headers = new Headers(init?.headers);
      seen.push({ url: address, requestId: headers.get('paypal-request-id') });
      if (address.endsWith('/v1/oauth2/token'))
        return json({ access_token: 'tok', expires_in: 3600 });
      if (address.endsWith('/v1/catalogs/products')) return json({ id: 'PROD-1' });
      if (address.endsWith('/v1/billing/plans')) return json({ id: 'PLAN-1' });
      return json({
        id: 'I-NEW',
        links: [{ rel: 'approve', href: 'https://paypal.example/approve' }],
      });
    }) as typeof fetch;
    const request = {
      checkoutId: 'checkout-1',
      payer: { userId: 'user-1', username: 'ana' },
      tier: { id: 'tier-1', name: 'Plus' },
      interval: 'monthly' as const,
      amountCents: 2500,
      currency: 'BRL',
      methodId: 'paypal',
      language: 'pt',
    };
    const context = { config: config(), store: new CheckoutStore(), fetchImpl, report: vi.fn() };

    await createPayPalProvider().createCheckout(request, context);
    // A new process: the plan cache is empty again.
    await createPayPalProvider().createCheckout({ ...request, checkoutId: 'checkout-2' }, context);

    const idsOf = (suffix: string) =>
      seen.filter((entry) => entry.url.endsWith(suffix)).map((entry) => entry.requestId);
    expect(idsOf('/v1/catalogs/products')).toEqual([
      'keres-product-tier-1',
      'keres-product-tier-1',
    ]);
    expect(idsOf('/v1/billing/plans')).toEqual([
      'keres-plan-tier-1-monthly-BRL-2500',
      'keres-plan-tier-1-monthly-BRL-2500',
    ]);
  });
});
