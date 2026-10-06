import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, type PaymentsConfig } from '../src/config';
import {
  canonicalRequest,
  canonicalResponse,
  sign,
  signatureMatches,
} from '../src/protocol/signing';
import { createApp, createState } from '../src/routes';
import type { Provider } from '../src/providers/types';

const CONNECTOR_SECRET = 'connector-secret-0123456789abcdef';
const EVENTS_SECRET = 'events-secret-0123456789abcdef-00';

function testConfig(): PaymentsConfig {
  return loadConfig({
    KERES_CONNECTOR_SECRET: CONNECTOR_SECRET,
    KERES_BASE_URL: 'http://127.0.0.1:3000',
    KERES_EVENTS_SECRET: EVENTS_SECRET,
    PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
  } as NodeJS.ProcessEnv);
}

const stub: Provider = {
  methodIds: ['stub'],
  hasStatus: false,
  hasCancel: false,
  methods: () => [{ id: 'stub', label: 'Stub' }],
  createCheckout: async (request) => ({
    providerReference: `stub-${request.checkoutId}`,
    action: { kind: 'redirect', url: 'https://provider.example/pay' },
  }),
};

let nonceCounter = 0;

function signedFetch(
  app: { fetch: (request: Request) => Promise<Response> },
  method: string,
  path: string,
  body: unknown = undefined,
  secret: string = CONNECTOR_SECRET,
) {
  const text = body === undefined ? '' : JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = `test-nonce-${(nonceCounter += 1)}-abcdefgh`;
  const headers: Record<string, string> = {
    'x-keres-timestamp': String(timestamp),
    'x-keres-nonce': nonce,
    'x-keres-signature': sign(
      secret,
      canonicalRequest({ method, path, timestamp, nonce, body: text }),
    ),
  };
  if (text) headers['content-type'] = 'application/json';
  return app
    .fetch(
      new Request(`http://127.0.0.1:3101${path}`, { method, headers, body: text || undefined }),
    )
    .then(async (response) => ({ response, nonce, text: await response.text() }));
}

function checkSigned(nonce: string, status: number, headers: Headers, text: string): void {
  const timestamp = Number(headers.get('x-keres-timestamp'));
  const signature = headers.get('x-keres-signature') ?? undefined;
  const canonical = canonicalResponse({ requestNonce: nonce, status, timestamp, body: text });
  expect(signatureMatches([CONNECTOR_SECRET], canonical, signature)).toBe(true);
}

describe('connector routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('answers /v1/info signed, and Keres can verify the answer', async () => {
    const app = createApp(createState(testConfig(), { providers: [stub] }));

    const { response, nonce, text } = await signedFetch(app, 'GET', '/v1/info');

    expect(response.status).toBe(200);
    checkSigned(nonce, 200, response.headers, text);
    expect(JSON.parse(text)).toEqual({
      apiVersion: 1,
      id: 'keres-payments',
      displayName: 'Keres Payments',
      capabilities: [],
    });
  });

  it('lists the stub method for any currency and signs errors too', async () => {
    const app = createApp(createState(testConfig(), { providers: [stub] }));

    const methods = await signedFetch(app, 'GET', '/v1/methods?currency=BRL');
    expect(methods.response.status).toBe(200);
    checkSigned(methods.nonce, 200, methods.response.headers, methods.text);
    // The stub predates `flow`: the wire fills the redirect default, so old connectors keep working.
    expect(JSON.parse(methods.text)).toEqual({
      methods: [{ id: 'stub', label: 'Stub', flow: 'redirect' }],
    });

    const bad = await signedFetch(app, 'GET', '/v1/methods?currency=XX');
    expect(bad.response.status).toBe(400);
    checkSigned(bad.nonce, 400, bad.response.headers, bad.text);
  });

  it('lists the native Play method only while Play is configured', async () => {
    const withPlay = loadConfig({
      KERES_CONNECTOR_SECRET: CONNECTOR_SECRET,
      KERES_BASE_URL: 'http://127.0.0.1:3000',
      KERES_EVENTS_SECRET: EVENTS_SECRET,
      PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
      PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000',
    } as NodeJS.ProcessEnv);
    const app = createApp(createState(withPlay, { providers: [stub] }));

    const { response, text } = await signedFetch(app, 'GET', '/v1/methods?currency=BRL');
    expect(response.status).toBe(200);
    expect(JSON.parse(text)).toEqual({
      methods: [
        { id: 'stub', label: 'Stub', flow: 'redirect' },
        {
          id: 'playbilling',
          label: 'Google Play',
          description: 'Pay inside the Android app through Google Play.',
          recurring: true,
          flow: 'native',
          store: 'play',
        },
      ],
    });
  });

  it('refuses a connector checkout naming the native Play method', async () => {
    const withPlay = loadConfig({
      KERES_CONNECTOR_SECRET: CONNECTOR_SECRET,
      KERES_BASE_URL: 'http://127.0.0.1:3000',
      KERES_EVENTS_SECRET: EVENTS_SECRET,
      PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
      PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000',
    } as NodeJS.ProcessEnv);
    const app = createApp(createState(withPlay, { providers: [stub] }));

    // The Play purchase happens in the app and is verified by token: it never starts here.
    const { response } = await signedFetch(app, 'POST', '/v1/checkouts', {
      checkoutId: 'checkout-play',
      payer: { userId: 'user-1', username: 'ana' },
      tier: { id: 'tier-1', name: 'Plus' },
      interval: 'monthly',
      amountCents: 2500,
      currency: 'BRL',
      methodId: 'playbilling',
      language: 'pt',
    });
    expect(response.status).toBe(400);
  });

  it('creates a checkout through the provider', async () => {
    const app = createApp(createState(testConfig(), { providers: [stub] }));
    const checkout = {
      checkoutId: 'checkout-1',
      payer: { userId: 'user-1', username: 'ana' },
      tier: { id: 'tier-1', name: 'Plus' },
      interval: 'monthly',
      amountCents: 2500,
      currency: 'BRL',
      methodId: 'stub',
      language: 'pt',
    };

    const { response, nonce, text } = await signedFetch(app, 'POST', '/v1/checkouts', checkout);

    expect(response.status).toBe(200);
    checkSigned(nonce, 200, response.headers, text);
    expect(JSON.parse(text)).toEqual({
      providerReference: 'stub-checkout-1',
      action: { kind: 'redirect', url: 'https://provider.example/pay' },
    });
  });

  it('refuses an unknown method, an unsigned call and a replay', async () => {
    const app = createApp(createState(testConfig(), { providers: [stub] }));
    const checkout = {
      checkoutId: 'checkout-1',
      payer: { userId: 'user-1', username: 'ana' },
      tier: { id: 'tier-1', name: 'Plus' },
      interval: 'monthly',
      amountCents: 2500,
      currency: 'BRL',
      methodId: 'nope',
      language: 'pt',
    };

    const unknown = await signedFetch(app, 'POST', '/v1/checkouts', checkout);
    expect(unknown.response.status).toBe(400);
    checkSigned(unknown.nonce, 400, unknown.response.headers, unknown.text);

    const forged = await signedFetch(
      app,
      'GET',
      '/v1/info',
      undefined,
      'wrong-secret-0000000000000000000000',
    );
    expect(forged.response.status).toBe(401);

    const replayHeaders = {
      'x-keres-timestamp': String(Math.floor(Date.now() / 1000)),
      'x-keres-nonce': 'replay-nonce-12345678',
      'x-keres-signature': sign(
        CONNECTOR_SECRET,
        canonicalRequest({
          method: 'GET',
          path: '/v1/info',
          timestamp: Math.floor(Date.now() / 1000),
          nonce: 'replay-nonce-12345678',
          body: '',
        }),
      ),
    };
    const first = await app.fetch(
      new Request('http://127.0.0.1:3101/v1/info', { headers: replayHeaders }),
    );
    expect(first.status).toBe(200);
    // A stuck clock between the two calls would read as stale, not replay; the window is
    // what makes the second identical call land on the nonce check.
    const second = await app.fetch(
      new Request('http://127.0.0.1:3101/v1/info', { headers: replayHeaders }),
    );
    expect(second.status).toBe(401);
  });

  it('leaves the health check unsigned', async () => {
    const app = createApp(createState(testConfig(), { providers: [] }));

    const response = await app.fetch(new Request('http://127.0.0.1:3101/health'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-keres-signature')).toBeNull();
    expect(await response.json()).toEqual({ ok: true });
  });
});
