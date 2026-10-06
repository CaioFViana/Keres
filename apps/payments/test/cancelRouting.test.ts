import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { canonicalRequest, sign } from '../src/protocol/signing';
import { createApp, createState } from '../src/routes';
import type { Provider } from '../src/providers/types';

const CONNECTOR_SECRET = 'connector-secret-0123456789abcdef';

const config = () =>
  loadConfig({
    KERES_CONNECTOR_SECRET: CONNECTOR_SECRET,
    KERES_BASE_URL: 'http://127.0.0.1:3000',
    KERES_EVENTS_SECRET: 'events-secret-0123456789abcdef-00',
    PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
  } as NodeJS.ProcessEnv);

let counter = 0;
function signedPost(app: { fetch: (request: Request) => Promise<Response> }, path: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = `cancel-nonce-${(counter += 1)}-abcdefghij`;
  return app.fetch(
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
}

function provider(id: string, prefix: string) {
  const cancel = vi.fn(async () => undefined);
  const value: Provider = {
    methodIds: [id],
    hasStatus: false,
    hasCancel: true,
    methods: () => [],
    createCheckout: async () => {
      throw new Error('not used');
    },
    ownsSubscription: (reference) => reference.startsWith(prefix),
    cancelSubscription: cancel,
  };
  return { value, cancel };
}

describe('cancelling a subscription', () => {
  it('goes to the provider that owns the reference, never to another one', async () => {
    const paypal = provider('paypal', 'I-');
    const stripe = provider('googlepay', 'sub_');
    const app = createApp(createState(config(), { providers: [paypal.value, stripe.value] }));

    expect((await signedPost(app, '/v1/subscriptions/sub_123/cancel')).status).toBe(200);
    expect(stripe.cancel).toHaveBeenCalledWith('sub_123', expect.anything());
    expect(paypal.cancel).not.toHaveBeenCalled();

    expect((await signedPost(app, '/v1/subscriptions/I-ABC/cancel')).status).toBe(200);
    expect(paypal.cancel).toHaveBeenCalledWith('I-ABC', expect.anything());
    expect(stripe.cancel).toHaveBeenCalledTimes(1);
  });

  it('refuses a reference no provider owns instead of pretending it was stopped', async () => {
    const paypal = provider('paypal', 'I-');
    const app = createApp(createState(config(), { providers: [paypal.value] }));

    // A store purchase token: it lives in the store, not at a provider this service charges through.
    const response = await signedPost(
      app,
      '/v1/subscriptions/ofbcjdkhgcdjliaejnmcjhki.AO-J1Oy/cancel',
    );

    expect(response.status).toBe(400);
    expect(paypal.cancel).not.toHaveBeenCalled();
  });

  it('answers 502 when the provider could not cancel, so Keres does not mark it stopped', async () => {
    const paypal = provider('paypal', 'I-');
    paypal.cancel.mockRejectedValueOnce(new Error('PayPal did not cancel the subscription (404).'));
    const app = createApp(createState(config(), { providers: [paypal.value] }));

    expect((await signedPost(app, '/v1/subscriptions/I-ABC/cancel')).status).toBe(502);
  });
});

describe('the PayPal return page', () => {
  it('looks the subscription up by `subscription_id`, not by the billing token', async () => {
    const getStatus = vi.fn(async () => ({
      type: 'payment.succeeded' as const,
      eventId: 'SALE-1',
      subscriptionReference: 'I-ABC',
      paidAt: '2026-10-04T12:00:00.000Z',
      amountCents: 2500,
      currency: 'BRL',
    }));
    const paypal: Provider = {
      methodIds: ['paypal'],
      hasStatus: true,
      hasCancel: false,
      methods: () => [],
      createCheckout: async () => {
        throw new Error('not used');
      },
      getStatus,
    };
    const report = vi.fn(async () => undefined);
    const app = createApp(createState(config(), { providers: [paypal], report }));

    const response = await app.fetch(
      new Request(
        'http://127.0.0.1:3101/v1/paypal/return?subscription_id=I-ABC&ba_token=BA-9&token=EC-9',
      ),
    );

    expect(response.status).toBe(200);
    expect(getStatus).toHaveBeenCalledWith('I-ABC', 'I-ABC', expect.anything());
    expect(report).toHaveBeenCalledTimes(1);
  });
});
