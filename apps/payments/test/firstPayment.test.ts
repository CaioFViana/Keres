import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { createPayPalProvider } from '../src/providers/paypal';
import { createStripeProvider } from '../src/providers/stripe';
import { CheckoutStore, type ProviderContext } from '../src/providers/types';

/**
 * One real payment must reach Keres as one event. Keres applies each event id once, so two notices
 * for the same charge under different ids would each grant a period: the first month paid for twice.
 * Each provider reports the first charge through several channels (webhook, return page, the
 * invoice behind a session); what is pinned here is that those channels agree on the id.
 */

const WEBHOOK_SECRET = 'whsec_test-0123456789abcdef-test';

function config() {
  return loadConfig({
    KERES_CONNECTOR_SECRET: 'connector-secret-0123456789abcdef',
    KERES_BASE_URL: 'http://127.0.0.1:3000',
    KERES_EVENTS_SECRET: 'events-secret-0123456789abcdef-00',
    PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
    PAYPAL_CLIENT_ID: 'client-id',
    PAYPAL_SECRET: 'paypal-secret',
    PAYPAL_WEBHOOK_ID: 'webhook-id',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  } as NodeJS.ProcessEnv);
}

function context(fetchImpl: typeof fetch): ProviderContext {
  return { config: config(), store: new CheckoutStore(), fetchImpl, report: vi.fn() };
}

const json = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });

function stripeWebhook(type: string, object: Record<string, unknown>): Request {
  const raw = JSON.stringify({ id: 'evt_x', type, data: { object } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${raw}`)
    .digest('hex');
  return new Request('http://127.0.0.1:3101/v1/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
    body: raw,
  });
}

const neverCalled = (async () => {
  throw new Error('no HTTP expected');
}) as unknown as typeof fetch;

describe('Stripe: the first payment is one event', () => {
  const session = {
    id: 'cs_1',
    payment_status: 'paid',
    amount_total: 2500,
    currency: 'brl',
    subscription: 'sub_1',
    invoice: 'in_1',
    metadata: { checkoutId: 'checkout-9' },
  };

  it('names the session payment after its invoice, from the webhook and from the return page alike', async () => {
    const provider = createStripeProvider();
    const [fromWebhook] =
      (await provider.handleWebhook?.(
        stripeWebhook('checkout.session.completed', session),
        context(neverCalled),
      )) ?? [];
    const fromReturn = await provider.getStatus?.(
      'checkout-9',
      'cs_1',
      context((async () => json({ ...session, status: 'complete' })) as unknown as typeof fetch),
    );

    expect(fromWebhook).toMatchObject({ eventId: 'stripe-invoice-in_1', checkoutId: 'checkout-9' });
    expect(fromReturn).toMatchObject({ eventId: 'stripe-invoice-in_1', checkoutId: 'checkout-9' });
  });

  it('does not report the first invoice again: the session already did', async () => {
    const provider = createStripeProvider();
    const events = await provider.handleWebhook?.(
      stripeWebhook('invoice.payment_succeeded', {
        id: 'in_1',
        subscription: 'sub_1',
        billing_reason: 'subscription_create',
        amount_paid: 2500,
        currency: 'brl',
      }),
      context(neverCalled),
    );
    expect(events).toEqual([]);
  });

  it('reports every later invoice, whichever field names its subscription', async () => {
    const provider = createStripeProvider();
    const older = await provider.handleWebhook?.(
      stripeWebhook('invoice.payment_succeeded', {
        id: 'in_2',
        subscription: 'sub_1',
        billing_reason: 'subscription_cycle',
        amount_paid: 2500,
        currency: 'brl',
      }),
      context(neverCalled),
    );
    const newer = await provider.handleWebhook?.(
      stripeWebhook('invoice.payment_succeeded', {
        id: 'in_3',
        parent: { subscription_details: { subscription: 'sub_1' } },
        billing_reason: 'subscription_cycle',
        amount_paid: 2500,
        currency: 'brl',
      }),
      context(neverCalled),
    );
    expect(older).toMatchObject([
      { eventId: 'stripe-invoice-in_2', subscriptionReference: 'sub_1' },
    ]);
    expect(newer).toMatchObject([
      { eventId: 'stripe-invoice-in_3', subscriptionReference: 'sub_1' },
    ]);
  });

  it('treats a subscription Stripe already has as canceled as cancelled: no second cancel, no failure', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
      return json({ id: 'sub_1', status: 'canceled' });
    }) as typeof fetch;

    await expect(
      createStripeProvider().cancelSubscription?.('sub_1', context(fetchImpl)),
    ).resolves.toBeUndefined();

    expect(calls.some((call) => call.startsWith('DELETE'))).toBe(false);
  });

  it('owns only its own subscriptions, and says so when Stripe refuses a cancel', async () => {
    const provider = createStripeProvider();
    expect(provider.ownsSubscription?.('sub_1')).toBe(true);
    expect(provider.ownsSubscription?.('I-SUB1')).toBe(false);
    expect(provider.ownsSubscription?.('play-token')).toBe(false);

    await expect(
      provider.cancelSubscription?.(
        'sub_1',
        context((async () => json({ error: { message: 'nope' } }, 404)) as unknown as typeof fetch),
      ),
    ).rejects.toThrow('did not cancel');
    await expect(
      provider.cancelSubscription?.(
        'sub_1',
        context((async () => json({ id: 'sub_1', status: 'canceled' })) as unknown as typeof fetch),
      ),
    ).resolves.toBeUndefined();
  });
});

describe('PayPal: the first payment is one event', () => {
  const sale = {
    event_type: 'PAYMENT.SALE.COMPLETED',
    resource: {
      id: 'SALE-1',
      billing_agreement_id: 'I-SUB1',
      amount: { total: '25.00', currency: 'BRL' },
      create_time: '2026-10-04T12:00:00Z',
    },
  };

  function paypalFetch(overrides: Record<string, () => Response> = {}): typeof fetch {
    return (async (url: string | URL | Request) => {
      const address = String(url);
      for (const [suffix, answer] of Object.entries(overrides)) {
        if (address.includes(suffix)) return answer();
      }
      if (address.endsWith('/v1/oauth2/token'))
        return json({ access_token: 'tok', expires_in: 3600 });
      if (address.includes('verify-webhook-signature'))
        return json({ verification_status: 'SUCCESS' });
      if (address.endsWith('/v1/billing/subscriptions/I-SUB1')) {
        return json({ id: 'I-SUB1', status: 'ACTIVE', custom_id: 'checkout-1' });
      }
      throw new Error(`unexpected call ${address}`);
    }) as typeof fetch;
  }

  const webhook = (body: unknown) =>
    new Request('http://127.0.0.1:3101/v1/paypal/webhook', {
      method: 'POST',
      body: JSON.stringify(body),
    });

  it('does not treat the activation as a payment: the sale is the payment', async () => {
    const events = await createPayPalProvider().handleWebhook?.(
      webhook({
        event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
        resource: { id: 'I-SUB1', custom_id: 'checkout-1' },
      }),
      context(paypalFetch()),
    );
    expect(events).toEqual([]);
  });

  it('does not treat a capture notice as a second payment either', async () => {
    const events = await createPayPalProvider().handleWebhook?.(
      webhook({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAP-1', amount: { value: '25.00', currency_code: 'BRL' } },
      }),
      context(paypalFetch()),
    );
    expect(events).toEqual([]);
  });

  it('gives the webhook and the return page the same id for the same charge', async () => {
    const provider = createPayPalProvider();
    const [fromWebhook] =
      (await provider.handleWebhook?.(webhook(sale), context(paypalFetch()))) ?? [];
    const fromReturn = await provider.getStatus?.(
      'checkout-1',
      'I-SUB1',
      context(
        paypalFetch({
          '/transactions?': () =>
            json({
              transactions: [
                {
                  id: 'SALE-1',
                  amount_with_breakdown: { gross_amount: { value: '25.00', currency_code: 'BRL' } },
                  time: '2026-10-04T12:00:00Z',
                },
              ],
            }),
        }),
      ),
    );
    expect(fromWebhook.eventId).toBe('SALE-1');
    expect(fromReturn?.eventId).toBe('SALE-1');
  });

  it('reports nothing for an approved subscription that has not been charged yet', async () => {
    const event = await createPayPalProvider().getStatus?.(
      'checkout-1',
      'I-SUB1',
      context(paypalFetch({ '/transactions?': () => json({ transactions: [] }) })),
    );
    expect(event).toBeNull();
  });

  it('lets PayPal retry a sale whose subscription could not be read', async () => {
    await expect(
      createPayPalProvider().handleWebhook?.(
        webhook(sale),
        context(paypalFetch({ '/v1/billing/subscriptions/I-SUB1': () => json({}, 500) })),
      ),
    ).rejects.toThrow('could not be read');
  });

  it('owns only its own subscriptions, and says so when PayPal refuses a cancel', async () => {
    const provider = createPayPalProvider();
    expect(provider.ownsSubscription?.('I-SUB1')).toBe(true);
    expect(provider.ownsSubscription?.('sub_1')).toBe(false);
    expect(provider.ownsSubscription?.('play-token')).toBe(false);

    const cancelling = (status: number, body: unknown = {}) =>
      context(paypalFetch({ '/cancel': () => json(body, status) }));
    await expect(
      provider.cancelSubscription?.('I-SUB1', cancelling(204, null)),
    ).resolves.toBeUndefined();
    await expect(provider.cancelSubscription?.('I-SUB1', cancelling(404))).rejects.toThrow(
      'did not cancel',
    );
    // Already over at PayPal is the goal reached, not a failure.
    await expect(
      provider.cancelSubscription?.(
        'I-SUB1',
        cancelling(422, { name: 'SUBSCRIPTION_STATUS_INVALID' }),
      ),
    ).resolves.toBeUndefined();
  });

  it('makes a new plan when the price changed, and one plan for checkouts at the same moment', async () => {
    const plans: string[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const address = String(url);
      if (address.endsWith('/v1/oauth2/token'))
        return json({ access_token: 'tok', expires_in: 3600 });
      if (address.endsWith('/v1/catalogs/products')) return json({ id: 'PROD-1' });
      if (address.endsWith('/v1/billing/plans')) {
        plans.push(
          JSON.parse(String(init?.body)).billing_cycles[0].pricing_scheme.fixed_price.value,
        );
        return json({ id: `PLAN-${plans.length}` });
      }
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
    const provider = createPayPalProvider();
    const ctx = context(fetchImpl);

    await Promise.all([
      provider.createCheckout(request, ctx),
      provider.createCheckout({ ...request, checkoutId: 'checkout-2' }, ctx),
    ]);
    expect(plans).toEqual(['25.00']);

    await provider.createCheckout({ ...request, checkoutId: 'checkout-3', amountCents: 3000 }, ctx);
    expect(plans).toEqual(['25.00', '30.00']);
  });
});
