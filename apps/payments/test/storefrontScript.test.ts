import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { createApp, createState } from '../src/routes';

/**
 * The buy site is one page with its script inline, so the only way to know it works is to run that
 * script. This loads the page the service serves into a DOM, signed in, with a stand-in for the Keres
 * server, and looks at what ends up on screen. (A page stuck on "Loading plans..." passed every
 * test that only looked at the HTML.)
 */

function config() {
  return loadConfig({
    KERES_CONNECTOR_SECRET: 'connector-secret-0123456789abcdef',
    KERES_BASE_URL: 'http://127.0.0.1:3000',
    KERES_EVENTS_SECRET: 'events-secret-0123456789abcdef-00',
    PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
  } as NodeJS.ProcessEnv);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const tiers = {
  currency: 'BRL',
  tiers: [
    {
      id: 'tier-free',
      name: 'Free',
      priceMonthlyCents: 0,
      priceYearlyCents: 0,
      webMonthlyEnabled: true,
      webYearlyEnabled: true,
    },
    {
      id: 'tier-pro',
      name: 'Pro',
      priceMonthlyCents: 2500,
      priceYearlyCents: 25000,
      webMonthlyEnabled: true,
      webYearlyEnabled: false,
    },
  ],
};

const methods = [
  { id: 'mock', label: 'Mock card (test only)', flow: 'redirect' },
  { id: 'playbilling', label: 'Google Play', flow: 'native', store: 'play' },
];

async function openStore(payments: unknown, signedIn = true) {
  const app = createApp(createState(config(), { providers: [] }));
  const html = await (await app.fetch(new Request('http://127.0.0.1:3101/'))).text();
  const calls: string[] = [];
  const dom = new JSDOM(html, {
    url: 'http://127.0.0.1:3101/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      if (signedIn) window.sessionStorage.setItem('keres.buy.token', 'token-1');
      (window as unknown as { fetch: typeof fetch }).fetch = (async (
        input: string | URL | Request,
      ) => {
        const address = String(input);
        calls.push(address);
        if (address.endsWith('/api/public/tiers')) return json(tiers);
        if (address.includes('/api/payments')) return json(payments);
        return json({}, 404);
      }) as typeof fetch;
    },
  });
  // Let the page's promises settle.
  for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  const document = dom.window.document;
  return { dom, document, app: document.getElementById('app') as HTMLElement, calls };
}

describe('buy site script', () => {
  it('shows the plans once signed in, instead of staying on "Loading plans..."', async () => {
    const { app } = await openStore({
      enabled: true,
      currency: 'BRL',
      methods,
      subscription: null,
    });

    expect(app.textContent).not.toContain('Loading plans');
    expect(app.textContent).toContain('Pro');
    expect(app.textContent).toContain('25.00 BRL');
  });

  it('offers only web methods: the store method is bought inside the Android app', async () => {
    const { app } = await openStore({
      enabled: true,
      currency: 'BRL',
      methods,
      subscription: null,
    });

    const labels = [...app.querySelectorAll('option')].map((option) => option.textContent);
    expect(labels).toContain('Mock card (test only)');
    expect(labels.join(' ')).not.toContain('Google Play');
  });

  it('offers only the periods the plan sells on the web', async () => {
    const { app } = await openStore({
      enabled: true,
      currency: 'BRL',
      methods,
      subscription: null,
    });

    const options = [...app.querySelectorAll('option')].map((option) => option.textContent ?? '');
    expect(options.some((text) => text.startsWith('Monthly - 25.00'))).toBe(true);
    // Pro is not sold yearly on the web: no yearly option for it (Free keeps both).
    expect(options.filter((text) => text.startsWith('Yearly - 250.00'))).toEqual([]);
  });

  it('shows the subscription with the date the server sends, and a stop only when it can stop it', async () => {
    const subscription = {
      tierId: 'tier-pro',
      tierName: 'Pro',
      status: 'active',
      paidUntil: '2026-11-05T23:07:36.555Z',
      cancelAtPeriodEnd: false,
      canCancelHere: true,
    };
    const { app } = await openStore({ enabled: true, currency: 'BRL', methods, subscription });
    expect(app.textContent).toContain('Paid until');
    expect(app.textContent).not.toContain('Invalid Date');
    expect(app.textContent).toContain('Stop renewing');

    const store = await openStore({
      enabled: true,
      currency: 'BRL',
      methods,
      subscription: { ...subscription, canCancelHere: false },
    });
    expect(store.app.textContent).toContain('Paid until');
    expect(store.app.textContent).not.toContain('Stop renewing');
  });

  it('asks to sign in when there is no session', async () => {
    const { app, calls } = await openStore({ enabled: true }, false);

    expect(app.textContent).toContain('Sign in with your Keres account');
    expect(calls).toEqual([]);
  });
});
