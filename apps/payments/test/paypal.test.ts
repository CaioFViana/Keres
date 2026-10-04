import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { createPayPalProvider } from '../src/providers/paypal';
import { CheckoutStore, type ProviderContext } from '../src/providers/types';

const CONNECTOR_SECRET = 'connector-secret-0123456789abcdef';
const EVENTS_SECRET = 'events-secret-0123456789abcdef-00';

function context(fetchImpl: typeof fetch, report = vi.fn()): ProviderContext {
  const config = loadConfig({
    KERES_CONNECTOR_SECRET: CONNECTOR_SECRET,
    KERES_BASE_URL: 'http://127.0.0.1:3000',
    KERES_EVENTS_SECRET: EVENTS_SECRET,
    PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
    PAYPAL_CLIENT_ID: 'client-id',
    PAYPAL_SECRET: 'paypal-secret',
    PAYPAL_SANDBOX: 'true',
    PAYPAL_WEBHOOK_ID: 'webhook-id',
  } as NodeJS.ProcessEnv);
  return { config, store: new CheckoutStore(), fetchImpl, report };
}

const checkout = {
  checkoutId: 'checkout-1',
  payer: { userId: 'user-1', username: 'ana' },
  tier: { id: 'tier-1', name: 'Plus' },
  interval: 'monthly' as const,
  amountCents: 2500,
  currency: 'BRL',
  methodId: 'paypal',
  language: 'pt',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('PayPal provider', () => {
  it('lists paypal for supported currencies only', () => {
    const provider = createPayPalProvider();
    expect(provider.methods('BRL')).toEqual([
      { id: 'paypal', label: 'PayPal', recurring: true, flow: 'redirect' },
    ]);
    expect(provider.methods('XXX')).toEqual([]);
  });

  it('creates a subscription checkout and remembers the reference', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const address = String(url);
      calls.push(`${init?.method ?? 'GET'} ${address}`);
      if (address.endsWith('/v1/oauth2/token')) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }
      if (address.endsWith('/v1/catalogs/products')) {
        expect(JSON.parse(init?.body as string)).toMatchObject({ name: 'Plus' });
        return jsonResponse({ id: 'PROD-1' });
      }
      if (address.endsWith('/v1/billing/plans')) {
        return jsonResponse({ id: 'PLAN-1' });
      }
      if (address.endsWith('/v1/billing/subscriptions')) {
        return jsonResponse({
          id: 'I-SUB1',
          links: [{ rel: 'approve', href: 'https://paypal.example/approve' }],
        });
      }
      throw new Error(`unexpected call ${address}`);
    }) as typeof fetch;

    const provider = createPayPalProvider();
    const ctx = context(fetchImpl);
    const result = await provider.createCheckout(checkout, ctx);

    expect(result).toEqual({
      providerReference: 'I-SUB1',
      action: { kind: 'redirect', url: 'https://paypal.example/approve' },
    });
    expect(ctx.store.recall('checkout-1')).toEqual({
      methodId: 'paypal',
      providerReference: 'I-SUB1',
      subscriptionReference: 'I-SUB1',
    });
    expect(calls.filter((call) => call.includes('/v1/oauth2/token'))).toHaveLength(1);
  });

  it('reports an active subscription from its latest transaction', async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      const address = String(url);
      if (address.endsWith('/v1/oauth2/token')) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }
      if (address.includes('/transactions?')) {
        return jsonResponse({
          transactions: [
            {
              id: 'TXN-9',
              amount_with_breakdown: { gross_amount: { value: '25.00', currency_code: 'BRL' } },
              time: '2026-10-04T12:00:00.000Z',
            },
          ],
        });
      }
      return jsonResponse({ status: 'ACTIVE' });
    }) as typeof fetch;

    const provider = createPayPalProvider();
    const event = await provider.getStatus?.('checkout-1', 'I-SUB1', context(fetchImpl));

    expect(event).toMatchObject({
      type: 'payment.succeeded',
      eventId: 'TXN-9',
      checkoutId: 'checkout-1',
      subscriptionReference: 'I-SUB1',
      amountCents: 2500,
      currency: 'BRL',
    });
  });

  it('translates webhook events after verifying the signature', async () => {
    const webhookEvent = {
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource: { id: 'I-SUB1', custom_id: 'checkout-1' },
    };
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const address = String(url);
      if (address.endsWith('/v1/oauth2/token')) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }
      const payload = JSON.parse(init?.body as string) as { webhook_id?: string };
      expect(payload.webhook_id).toBe('webhook-id');
      return jsonResponse({ verification_status: 'SUCCESS' });
    }) as typeof fetch;

    const provider = createPayPalProvider();
    const events = await provider.handleWebhook?.(
      new Request('http://127.0.0.1:3101/v1/paypal/webhook', {
        method: 'POST',
        body: JSON.stringify(webhookEvent),
      }),
      context(fetchImpl),
    );

    expect(events).toHaveLength(1);
    expect(events?.[0]).toMatchObject({
      type: 'payment.succeeded',
      checkoutId: 'checkout-1',
      subscriptionReference: 'I-SUB1',
    });
  });

  it('rejects a webhook PayPal did not confirm', async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).endsWith('/v1/oauth2/token')) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }
      return jsonResponse({ verification_status: 'FAILURE' });
    }) as typeof fetch;

    const provider = createPayPalProvider();
    await expect(
      provider.handleWebhook?.(
        new Request('http://127.0.0.1:3101/v1/paypal/webhook', {
          method: 'POST',
          body: JSON.stringify({ event_type: 'X', resource: {} }),
        }),
        context(fetchImpl),
      ),
    ).rejects.toThrow('signature rejected');
  });
});
