import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { createMockProvider } from '../src/providers/mock';
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

describe('buy site', () => {
  it('serves the storefront with the Keres address baked in', async () => {
    const app = createApp(createState(config(), { providers: [createMockProvider()] }));

    const response = await app.fetch(new Request('http://127.0.0.1:3101/'));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(text).toContain('http://127.0.0.1:3000');
    expect(text).toContain('Sign in with your Keres account');
    expect(text).toContain('TEST MODE');
  });

  it('hides the test banner when no mock provider is registered', async () => {
    const app = createApp(createState(config(), { providers: [] }));

    const text = await (await app.fetch(new Request('http://127.0.0.1:3101/'))).text();

    expect(text).not.toContain('TEST MODE');
    expect(text).toContain('Sign in with your Keres account');
  });

  it('styles the mock approval page like the store', async () => {
    const state = createState(config(), { providers: [createMockProvider()] });
    const app = createApp(state);
    await createMockProvider().createCheckout(
      {
        checkoutId: 'checkout-style-1',
        payer: { userId: 'user-1', username: 'ana' },
        tier: { id: 'tier-1', name: 'Plus' },
        interval: 'monthly',
        amountCents: 990,
        currency: 'BRL',
        methodId: 'mock',
        language: 'pt',
      },
      { config: config(), store: state.store, fetchImpl: fetch, report: async () => {} },
    );

    const text = await (
      await app.fetch(new Request('http://127.0.0.1:3101/v1/mock/pay?checkoutId=checkout-style-1'))
    ).text();

    expect(text).toContain('Mock payment');
    expect(text).toContain('Plus');
    expect(text).toContain('Confirm payment');
  });
});
