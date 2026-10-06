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

  it('offers only the web: no store method, no period the plan does not sell on the web', async () => {
    const app = createApp(createState(config(), { providers: [] }));

    const text = await (await app.fetch(new Request('http://127.0.0.1:3101/'))).text();

    // The store method is bought inside the Android app, never on a web page.
    expect(text).toContain("(m.flow || 'redirect') === 'redirect'");
    expect(text).toContain('tier.webMonthlyEnabled === false');
    expect(text).toContain('tier.webYearlyEnabled === false');
    // It reads the date the server sends, and offers a stop only where this server can stop it.
    expect(text).toContain('subscription.paidUntil');
    expect(text).toContain('subscription.canCancelHere');
  });
});
