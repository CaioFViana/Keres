import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { createStripeProvider, verifyStripeSignature } from '../src/providers/stripe';
import { CheckoutStore, type ProviderContext } from '../src/providers/types';

const CONNECTOR_SECRET = 'connector-secret-0123456789abcdef';
const EVENTS_SECRET = 'events-secret-0123456789abcdef-00';
const WEBHOOK_SECRET = 'whsec_test-0123456789abcdef-test';

function context(fetchImpl: typeof fetch): ProviderContext {
  const config = loadConfig({
    KERES_CONNECTOR_SECRET: CONNECTOR_SECRET,
    KERES_BASE_URL: 'http://127.0.0.1:3000',
    KERES_EVENTS_SECRET: EVENTS_SECRET,
    PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  } as NodeJS.ProcessEnv);
  return { config, store: new CheckoutStore(), fetchImpl, report: vi.fn() };
}

const checkout = {
  checkoutId: 'checkout-9',
  payer: { userId: 'user-1', username: 'ana' },
  tier: { id: 'tier-1', name: 'Plus' },
  interval: 'monthly' as const,
  amountCents: 2500,
  currency: 'BRL',
  methodId: 'googlepay',
  language: 'pt',
};

function signStripe(raw: string, timestamp: number): string {
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${raw}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('Google Pay provider (Stripe Checkout)', () => {
  it('creates a subscription session and redirects to it', async () => {
    const seen: Array<{ url: string; body: string }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), body: String(init?.body ?? '') });
      return new Response(
        JSON.stringify({ id: 'cs_123', url: 'https://checkout.stripe.example/pay' }),
      );
    }) as typeof fetch;

    const provider = createStripeProvider();
    const ctx = context(fetchImpl);
    const result = await provider.createCheckout(checkout, ctx);

    expect(result).toEqual({
      providerReference: 'cs_123',
      action: { kind: 'redirect', url: 'https://checkout.stripe.example/pay' },
    });
    expect(ctx.store.recall('checkout-9')?.providerReference).toBe('cs_123');
    const params = new URLSearchParams(seen[0].body);
    expect(params.get('mode')).toBe('subscription');
    expect(params.get('line_items[0][price_data][recurring][interval]')).toBe('month');
    expect(params.get('client_reference_id')).toBe('checkout-9');
  });

  it('verifies webhook signatures by timestamp and HMAC', () => {
    const raw = '{"id":"evt_1"}';
    const timestamp = Math.floor(Date.now() / 1000);
    expect(verifyStripeSignature(WEBHOOK_SECRET, raw, signStripe(raw, timestamp))).toBe(true);
    expect(
      verifyStripeSignature(WEBHOOK_SECRET, raw, signStripe('{"id":"evt_2"}', timestamp)),
    ).toBe(false);
    expect(verifyStripeSignature(WEBHOOK_SECRET, raw, signStripe(raw, timestamp - 600))).toBe(
      false,
    );
    expect(verifyStripeSignature(WEBHOOK_SECRET, raw, null)).toBe(false);
  });

  it('turns a completed session into a renewal-capable event', async () => {
    const session = {
      id: 'cs_123',
      payment_status: 'paid',
      amount_total: 2500,
      currency: 'brl',
      subscription: 'sub_123',
      metadata: { checkoutId: 'checkout-9' },
    };
    const raw = JSON.stringify({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: session },
    });
    const fetchImpl = (async () => {
      throw new Error('no HTTP expected');
    }) as unknown as typeof fetch;

    const provider = createStripeProvider();
    const events = await provider.handleWebhook?.(
      new Request('http://127.0.0.1:3101/v1/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': signStripe(raw, Math.floor(Date.now() / 1000)) },
        body: raw,
      }),
      context(fetchImpl),
    );

    expect(events).toEqual([
      {
        type: 'payment.succeeded',
        eventId: 'stripe-session-cs_123',
        checkoutId: 'checkout-9',
        subscriptionReference: 'sub_123',
        paidAt: expect.any(String),
        amountCents: 2500,
        currency: 'BRL',
      },
    ]);
  });

  it('reports subscription deletions as cancellations', async () => {
    const raw = JSON.stringify({
      id: 'evt_2',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_123' } },
    });
    const fetchImpl = (async () => {
      throw new Error('no HTTP expected');
    }) as unknown as typeof fetch;

    const provider = createStripeProvider();
    const events = await provider.handleWebhook?.(
      new Request('http://127.0.0.1:3101/v1/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': signStripe(raw, Math.floor(Date.now() / 1000)) },
        body: raw,
      }),
      context(fetchImpl),
    );

    expect(events).toEqual([
      {
        type: 'subscription.canceled',
        eventId: 'stripe-cancel-sub_123',
        subscriptionReference: 'sub_123',
      },
    ]);
  });
});
