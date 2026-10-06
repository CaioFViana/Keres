import { createHmac, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import {
  cancelPlaySubscription,
  PlayCancelUnsupported,
  verifyPlayPurchase,
} from '../src/playbilling';
import { canonicalRequest, sign } from '../src/protocol/signing';
import { createPayPalProvider } from '../src/providers/paypal';
import { createStripeProvider } from '../src/providers/stripe';
import { CheckoutStore, type ProviderContext } from '../src/providers/types';
import { createApp, createState } from '../src/routes';

const WEBHOOK_SECRET = 'whsec_test-0123456789abcdef-test';
const CONNECTOR_SECRET = 'connector-secret-0123456789abcdef';

function env(extra: Record<string, string> = {}) {
  return {
    KERES_CONNECTOR_SECRET: CONNECTOR_SECRET,
    KERES_BASE_URL: 'http://127.0.0.1:3000',
    KERES_EVENTS_SECRET: 'events-secret-0123456789abcdef-00',
    PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
    PAYPAL_CLIENT_ID: 'client-id',
    PAYPAL_SECRET: 'paypal-secret',
    PAYPAL_WEBHOOK_ID: 'webhook-id',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    ...extra,
  } as NodeJS.ProcessEnv;
}
const config = (extra: Record<string, string> = {}) => loadConfig(env(extra));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function context(fetchImpl: typeof fetch): ProviderContext {
  return { config: config(), store: new CheckoutStore(), fetchImpl, report: vi.fn() };
}

describe('PayPal: money that went back', () => {
  const sale = {
    id: 'SALE-1',
    billing_agreement_id: 'I-SUB1',
    amount: { total: '25.00', currency: 'BRL' },
    create_time: '2026-10-04T12:00:00Z',
  };
  function paypalSays(saleAnswer: unknown, status = 200): typeof fetch {
    return (async (input: string | URL | Request) => {
      const address = String(input);
      if (address.endsWith('/v1/oauth2/token'))
        return json({ access_token: 'tok', expires_in: 3600 });
      if (address.includes('verify-webhook-signature'))
        return json({ verification_status: 'SUCCESS' });
      if (address.includes('/v1/payments/sale/')) return json(saleAnswer, status);
      throw new Error(`unexpected call ${address}`);
    }) as typeof fetch;
  }
  const webhook = (body: unknown) =>
    new Request('http://127.0.0.1:3101/v1/paypal/webhook', {
      method: 'POST',
      body: JSON.stringify(body),
    });

  it('reports a full refund of a subscription sale as one that takes the period back', async () => {
    const events = await createPayPalProvider().handleWebhook?.(
      webhook({
        event_type: 'PAYMENT.SALE.REFUNDED',
        resource: {
          id: 'REFUND-1',
          sale_id: 'SALE-1',
          amount: { total: '25.00', currency: 'BRL' },
          create_time: '2026-10-06T09:00:00Z',
        },
      }),
      context(paypalSays(sale)),
    );

    expect(events).toEqual([
      {
        type: 'payment.refunded',
        eventId: 'paypal-refund-REFUND-1',
        subscriptionReference: 'I-SUB1',
        refundedAt: '2026-10-06T09:00:00Z',
        chargedAt: '2026-10-04T12:00:00Z',
        amountCents: 2500,
        currency: 'BRL',
        endsAccess: true,
      },
    ]);
  });

  it('reports a partial refund as one that does not', async () => {
    const [event] =
      (await createPayPalProvider().handleWebhook?.(
        webhook({
          event_type: 'PAYMENT.SALE.REFUNDED',
          resource: {
            id: 'REFUND-2',
            sale_id: 'SALE-1',
            amount: { total: '5.00', currency: 'BRL' },
          },
        }),
        context(paypalSays(sale)),
      )) ?? [];

    expect(event).toMatchObject({ amountCents: 500, endsAccess: false });
  });

  it('takes a reversed sale (a chargeback) as the whole sale going back', async () => {
    const [event] =
      (await createPayPalProvider().handleWebhook?.(
        webhook({ event_type: 'PAYMENT.SALE.REVERSED', resource: { id: 'SALE-1' } }),
        context(paypalSays(sale)),
      )) ?? [];

    expect(event).toMatchObject({ type: 'payment.refunded', amountCents: 2500, endsAccess: true });
  });

  it("says nothing about a sale that is not a subscription's, and lets PayPal retry one it could not read", async () => {
    const provider = createPayPalProvider();
    const refund = webhook({
      event_type: 'PAYMENT.SALE.REFUNDED',
      resource: { id: 'REFUND-3', sale_id: 'SALE-9', amount: { total: '1.00', currency: 'BRL' } },
    });

    expect(
      await provider.handleWebhook?.(
        refund,
        context(paypalSays({ id: 'SALE-9', amount: sale.amount })),
      ),
    ).toEqual([]);
    await expect(
      provider.handleWebhook?.(
        webhook({
          event_type: 'PAYMENT.SALE.REFUNDED',
          resource: {
            id: 'REFUND-3',
            sale_id: 'SALE-9',
            amount: { total: '1.00', currency: 'BRL' },
          },
        }),
        context(paypalSays({}, 500)),
      ),
    ).rejects.toThrow('could not be read');
  });
});

describe('Stripe: money that went back', () => {
  function stripeWebhook(
    type: string,
    object: Record<string, unknown>,
    created = 1_790_100_000,
  ): Request {
    const raw = JSON.stringify({ id: 'evt_x', type, created, data: { object } });
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
  const charge = {
    id: 'ch_1',
    amount: 2500,
    amount_refunded: 2500,
    refunded: true,
    currency: 'brl',
    payment_intent: 'pi_1',
    created: 1_790_000_000,
  };
  function stripeSays(
    seen: string[] = [],
    invoice: Record<string, unknown> = {
      id: 'in_1',
      parent: { subscription_details: { subscription: 'sub_1' } },
    },
  ) {
    return (async (input: string | URL | Request) => {
      const address = String(input);
      seen.push(address);
      if (address.includes('/v1/invoice_payments')) return json({ data: [{ invoice: 'in_1' }] });
      if (address.includes('/v1/invoices/in_1')) return json(invoice);
      return json({}, 404);
    }) as typeof fetch;
  }

  it('finds the subscription through the payment intent and the invoice, and reports a full refund', async () => {
    const seen: string[] = [];
    const events = await createStripeProvider().handleWebhook?.(
      stripeWebhook('charge.refunded', charge),
      context(stripeSays(seen)),
    );

    expect(events).toEqual([
      {
        type: 'payment.refunded',
        eventId: 'stripe-refund-ch_1-2500',
        subscriptionReference: 'sub_1',
        refundedAt: new Date(1_790_100_000 * 1000).toISOString(),
        chargedAt: new Date(1_790_000_000 * 1000).toISOString(),
        amountCents: 2500,
        currency: 'BRL',
        endsAccess: true,
      },
    ]);
    const asked = new URL(
      seen.find((address) => address.includes('/v1/invoice_payments')) as string,
    );
    expect(asked.searchParams.get('payment[type]')).toBe('payment_intent');
    expect(asked.searchParams.get('payment[payment_intent]')).toBe('pi_1');
  });

  it('reads the subscription from older invoices too, and makes each partial refund its own', async () => {
    const provider = createStripeProvider();
    const partial = { ...charge, refunded: false, amount_refunded: 500 };
    const older = stripeSays([], { id: 'in_1', subscription: 'sub_1' });

    const [first] =
      (await provider.handleWebhook?.(stripeWebhook('charge.refunded', partial), context(older))) ??
      [];
    const [second] =
      (await provider.handleWebhook?.(
        stripeWebhook('charge.refunded', { ...partial, amount_refunded: 900 }),
        context(older),
      )) ?? [];

    expect(first).toMatchObject({
      subscriptionReference: 'sub_1',
      amountCents: 500,
      endsAccess: false,
    });
    expect(second.eventId).not.toBe(first.eventId);
  });

  it("says nothing for a charge that is not an invoice's, and lets Stripe retry what it could not look up", async () => {
    const provider = createStripeProvider();
    const noInvoice = (async () => json({ data: [] })) as unknown as typeof fetch;

    expect(
      await provider.handleWebhook?.(stripeWebhook('charge.refunded', charge), context(noInvoice)),
    ).toEqual([]);
    await expect(
      provider.handleWebhook?.(
        stripeWebhook('charge.refunded', charge),
        context((async () => json({}, 500)) as unknown as typeof fetch),
      ),
    ).rejects.toThrow('could not look up');
  });
});

describe('Play: whose purchase counts', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const live = (extra: Record<string, unknown> = {}) => ({
    serviceAccountJson: JSON.stringify({
      client_email: 'a@b.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    }),
    mock: false,
    ...extra,
  });
  const lookup = {
    packageName: 'me.keres.app',
    productId: 'plus_monthly',
    purchaseToken: 'token-abc',
    purchaseKind: 'subscription' as const,
  };
  const active = {
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    lineItems: [{ productId: 'plus_monthly', latestSuccessfulOrderId: 'GPA.1' }],
  };
  function google(answer: Record<string, unknown>, calls: string[] = []): typeof fetch {
    return (async (input: string | URL | Request) => {
      calls.push(String(input));
      return String(input).includes('oauth2.googleapis.com')
        ? new Response(JSON.stringify({ access_token: 'google-tok' }))
        : new Response(JSON.stringify(answer));
    }) as typeof fetch;
  }

  it("does not count a license tester's purchase as money, unless homologation says it does", async () => {
    const tester = { ...active, testPurchase: {} };

    expect((await verifyPlayPurchase(live(), lookup, google(tester))).active).toBe(false);
    expect(
      (await verifyPlayPurchase(live({ acceptTestPurchases: true }), lookup, google(tester)))
        .active,
    ).toBe(true);
    // A real purchase is untouched by the switch.
    expect((await verifyPlayPurchase(live(), lookup, google(active))).active).toBe(true);
  });

  it("does not even ask Google about a package that is not the app's", async () => {
    const calls: string[] = [];

    const verification = await verifyPlayPurchase(
      live({ packageName: 'me.keres.app' }),
      { ...lookup, packageName: 'com.other.app' },
      google(active, calls),
    );

    expect(verification.active).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe('Play: stopping a store subscription from here', () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const live = (extra: Record<string, unknown> = {}) => ({
    serviceAccountJson: JSON.stringify({
      client_email: 'a@b.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    }),
    mock: false,
    packageName: 'me.keres.app',
    ...extra,
  });
  function google(
    state: string,
    calls: Array<{ method: string; url: string; body?: string }> = [],
    cancelStatus = 200,
  ) {
    return (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({
        method: init?.method ?? 'GET',
        url,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      if (url.includes('oauth2.googleapis.com')) return json({ access_token: 'google-tok' });
      if (url.endsWith(':cancel')) return json({}, cancelStatus);
      return json({ subscriptionState: state });
    }) as typeof fetch;
  }

  it('asks Google to stop the renewals only, the way the person would in the Play Store', async () => {
    const calls: Array<{ method: string; url: string; body?: string }> = [];

    await cancelPlaySubscription(live(), 'token/abc', google('SUBSCRIPTION_STATE_ACTIVE', calls));

    const cancel = calls.at(-1)!;
    expect(cancel.method).toBe('POST');
    expect(cancel.url).toBe(
      'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/me.keres.app/purchases/subscriptionsv2/tokens/token%2Fabc:cancel',
    );
    expect(JSON.parse(cancel.body as string)).toEqual({
      cancellationContext: { cancellationType: 'USER_REQUESTED_STOP_RENEWALS' },
    });
  });

  it('leaves one that is already cancelled or over alone: that is the goal reached', async () => {
    for (const state of ['SUBSCRIPTION_STATE_CANCELED', 'SUBSCRIPTION_STATE_EXPIRED']) {
      const calls: Array<{ method: string; url: string }> = [];
      await cancelPlaySubscription(live(), 'token-abc', google(state, calls));
      expect(calls.some((call) => call.method === 'POST' && call.url.endsWith(':cancel'))).toBe(
        false,
      );
    }
  });

  it("fails, and says so, when Google refuses; cannot try without the app's package; does nothing in mock mode", async () => {
    await expect(
      cancelPlaySubscription(live(), 'token-abc', google('SUBSCRIPTION_STATE_ACTIVE', [], 403)),
    ).rejects.toThrow('did not cancel');
    await expect(
      cancelPlaySubscription(
        live({ packageName: null }),
        'token-abc',
        google('SUBSCRIPTION_STATE_ACTIVE'),
      ),
    ).rejects.toBeInstanceOf(PlayCancelUnsupported);
    const calls: Array<{ method: string; url: string }> = [];
    await cancelPlaySubscription(
      { serviceAccountJson: '', mock: true },
      'token-abc',
      google('x', calls),
    );
    expect(calls).toEqual([]);
  });

  describe('through the connector', () => {
    let counter = 0;
    function signedPost(app: { fetch: (request: Request) => Promise<Response> }, path: string) {
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = `play-cancel-nonce-${(counter += 1)}-abcdefghij`;
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
    const playEnv = {
      PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000',
      PLAY_MOCK: 'true',
    };

    it("advertises cancelling once the app's package is known (or in mock mode), and not before", async () => {
      const info = async (extra: Record<string, string>) => {
        const app = createApp(
          createState(
            loadConfig(
              env({
                PAYPAL_CLIENT_ID: '',
                PAYPAL_SECRET: '',
                STRIPE_SECRET_KEY: '',
                STRIPE_WEBHOOK_SECRET: '',
                ...extra,
              }),
            ),
            { providers: [] },
          ),
        );
        const path = '/v1/info';
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = `info-nonce-${(counter += 1)}-abcdefghijklmn`;
        const response = await app.fetch(
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
        return ((await response.json()) as { capabilities: string[] }).capabilities;
      };

      expect(await info({})).not.toContain('cancel');
      expect(
        await info({ PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000' }),
      ).not.toContain('cancel');
      expect(await info({ ...playEnv, PLAY_PACKAGE_NAME: 'me.keres.app' })).toContain('cancel');
      expect(await info(playEnv)).toContain('cancel');
    });

    it('sends a reference no provider owns to the store, and refuses it (400) when the package is not set', async () => {
      const withPackage = createApp(
        createState(loadConfig(env({ ...playEnv, PLAY_PACKAGE_NAME: 'me.keres.app' })), {
          providers: [],
        }),
      );
      expect(
        (await signedPost(withPackage, '/v1/subscriptions/ofbcjdkhgcdjliaejnmcjhki.AO-J1Oy/cancel'))
          .status,
      ).toBe(200);

      const live = createApp(
        createState(
          loadConfig(env({ PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000' })),
          {
            providers: [],
          },
        ),
      );
      expect(
        (await signedPost(live, '/v1/subscriptions/ofbcjdkhgcdjliaejnmcjhki.AO-J1Oy/cancel'))
          .status,
      ).toBe(400);
    });
  });
});
