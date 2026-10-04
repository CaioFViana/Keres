import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import {
  createMockProvider,
  mockEnabled,
  mockOutcome,
  MOCK_METHOD_ID,
} from '../src/providers/mock';
import { CheckoutStore, type ProviderContext } from '../src/providers/types';
import { createApp, createState } from '../src/routes';

const CONNECTOR_SECRET = 'connector-secret-0123456789abcdef';
const EVENTS_SECRET = 'events-secret-0123456789abcdef-00';

function config() {
  return loadConfig({
    KERES_CONNECTOR_SECRET: CONNECTOR_SECRET,
    KERES_BASE_URL: 'http://127.0.0.1:3000',
    KERES_EVENTS_SECRET: EVENTS_SECRET,
    PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
  } as NodeJS.ProcessEnv);
}

function context(): ProviderContext {
  return { config: config(), store: new CheckoutStore(), fetchImpl: fetch, report: vi.fn() };
}

const checkout = {
  checkoutId: 'checkout-mock-1',
  payer: { userId: 'user-1', username: 'ana' },
  tier: { id: 'tier-1', name: 'Plus' },
  interval: 'monthly' as const,
  amountCents: 2500,
  currency: 'BRL' as const,
  methodId: MOCK_METHOD_ID,
  language: 'pt',
};

describe('mock provider', () => {
  it('is gated on the flag and on loopback', () => {
    expect(mockEnabled('http://127.0.0.1:3101')).toBe(false);
    process.env.MOCK_METHODS = 'true';
    try {
      expect(mockEnabled('http://127.0.0.1:3101')).toBe(true);
      expect(mockEnabled('https://buy.keres.me')).toBe(false);
    } finally {
      delete process.env.MOCK_METHODS;
    }
  });

  it('creates a checkout pointing at the local approval page', async () => {
    const provider = createMockProvider();
    expect(provider.methods('BRL')).toEqual([
      { id: 'mock', label: 'Mock card (test only)', recurring: true, flow: 'redirect' },
    ]);

    const result = await provider.createCheckout(checkout, context());

    expect(result).toEqual({
      providerReference: 'mock-checkout-mock-1',
      action: {
        kind: 'redirect',
        url: 'http://127.0.0.1:3101/v1/mock/pay?checkoutId=checkout-mock-1',
      },
    });
    expect(mockOutcome('checkout-mock-1')).toBeUndefined();
  });

  it('reports nothing until the page is decided', async () => {
    const provider = createMockProvider();
    const ctx = context();
    await provider.createCheckout(checkout, ctx);

    expect(await provider.getStatus?.('checkout-mock-1', 'mock-checkout-mock-1', ctx)).toBeNull();
  });

  it('confirms through the page and reports the event to Keres', async () => {
    const reported: Array<{ type: string }> = [];
    const state = createState(config(), {
      providers: [createMockProvider()],
      report: async (events) => {
        reported.push(...events);
      },
    });
    const app = createApp(state);
    await createMockProvider().createCheckout(checkout, {
      config: config(),
      store: state.store,
      fetchImpl: fetch,
      report: async () => {},
    });

    const page = await app.fetch(
      new Request('http://127.0.0.1:3101/v1/mock/pay?checkoutId=checkout-mock-1'),
    );
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Mock payment');

    const decided = await app.fetch(
      new Request('http://127.0.0.1:3101/v1/mock/pay', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          checkoutId: 'checkout-mock-1',
          verdict: 'confirmed',
        }).toString(),
      }),
    );
    expect(decided.status).toBe(200);
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({
      type: 'payment.succeeded',
      checkoutId: 'checkout-mock-1',
      amountCents: 2500,
      currency: 'BRL',
    });
  });
});
