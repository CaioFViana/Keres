import { describe, expect, it, vi } from 'vitest';
import { HttpConnector } from '../../../src/services/payments/connector/HttpConnector';
import {
  ConnectorError,
  MAX_RESPONSE_BYTES,
} from '../../../src/services/payments/connector/signedClient';
import {
  HEADER_NONCE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
} from '../../../src/services/payments/connector/signing';
import { connectorDouble, KERES_KEY, OLD_KEY, type Reply } from '../../helpers/connectorDouble';

const connect = (
  double: ReturnType<typeof connectorDouble>,
  options: Partial<Parameters<typeof HttpConnector.connect>[0]> = {},
) =>
  HttpConnector.connect({
    baseUrl: 'https://connector.test/pay-base',
    secrets: [KERES_KEY],
    timeoutMs: 2000,
    fetchImpl: double.fetchImpl,
    ...options,
  });

const rejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as ConnectorError;
  }
  throw new Error('it was not refused');
};

describe('connecting', () => {
  it('learns who the connector is and what it can do, and has only that', async () => {
    const connector = await connect(connectorDouble());

    expect(connector.id).toBe('acme');
    expect(connector.displayName).toBe('Acme Pay');
    expect(connector.capabilities).toEqual(['status', 'cancel', 'due']);
    expect(connector.getCheckoutStatus).toBeTypeOf('function');
    expect(connector.cancelSubscription).toBeTypeOf('function');
    expect(connector.onSubscriptionDue).toBeTypeOf('function');
  });

  it('has none of the optional parts the connector did not say it implements', async () => {
    const connector = await connect(connectorDouble({ info: { capabilities: [] } }));
    const partial = await connect(connectorDouble({ info: { capabilities: ['cancel'] } }));

    expect(connector.getCheckoutStatus).toBeUndefined();
    expect(connector.cancelSubscription).toBeUndefined();
    expect(connector.onSubscriptionDue).toBeUndefined();
    expect(partial.cancelSubscription).toBeTypeOf('function');
    expect(partial.onSubscriptionDue).toBeUndefined();
  });

  it('signs even this first request, and keeps the contract’s own path under a base path', async () => {
    const double = connectorDouble();

    await connect(double);

    expect(double.seen[0]).toMatchObject({ method: 'GET', path: '/v1/info', verified: true });
    expect(double.seen[0].headers.get(HEADER_NONCE)).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it.each([
    ['a contract of another version', { apiVersion: 2 }],
    ['an id that is not one', { id: 'Acme Pay!' }],
    ['no name', { displayName: '' }],
    ['a capability that does not exist', { capabilities: ['refund'] }],
  ])('refuses %s', async (_label, info) => {
    const error = await rejection(connect(connectorDouble({ info })));

    expect(error).toBeInstanceOf(ConnectorError);
    expect(error.failure).toBe('invalid');
  });
});

describe('an answer that is not the connector’s', () => {
  const asked = (reply: Reply) =>
    connect(connectorDouble({ replies: { 'GET /v1/info': () => reply } }));

  it('is refused when it is not signed, or is signed with another key', async () => {
    for (const reply of [
      { body: {}, unsigned: true },
      { body: {}, key: OLD_KEY },
    ]) {
      const error = await rejection(asked(reply));
      expect(error.failure).toBe('signature');
    }
  });

  it('is refused when it answers another request, or comes from another time', async () => {
    expect((await rejection(asked({ body: {}, nonce: 'z'.repeat(24) }))).failure).toBe('signature');
    expect((await rejection(asked({ body: {}, at: Date.now() - 3600_000 }))).failure).toBe(
      'signature',
    );
  });

  it('is refused when it was changed after it was signed, or its status was', async () => {
    const tamper = (headers: Record<string, string>) => headers;
    expect(tamper).toBeTypeOf('function');
    const double = connectorDouble({
      replies: {
        'GET /v1/info': () => ({ rawBody: '{"apiVersion":1}', body: undefined }),
      },
    });
    // The double signs what it sends, so a change on the way is a different thing: it is sent, signed for another body.
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await double.fetchImpl(input, init);
      const text = await response.text();
      return new Response(text.replace('apiVersion', 'apiVersioN'), {
        status: response.status,
        headers: response.headers,
      });
    }) as typeof fetch;

    const error = await rejection(connect(double, { fetchImpl }));

    expect(error.failure).toBe('signature');
  });

  it('says nothing of what an unproven answer contained', async () => {
    const error = await rejection(asked({ body: { secret: 'the card number' }, unsigned: true }));

    expect(error.message).not.toContain('card number');
    expect(error.message).toMatch(/refused/);
  });

  it('is refused, whatever it says, when it is a redirect the server must not follow', async () => {
    const error = await rejection(
      connect(
        connectorDouble({
          replies: {
            'GET /v1/info': () => ({ fail: new TypeError('redirect mode is set to error') }),
          },
        }),
      ),
    );

    expect(error.failure).toBe('transport');
  });
});

describe('an answer that is the connector’s but not what the contract says', () => {
  it.each([
    ['one that is not JSON', { rawBody: 'oops' }, 'invalid'],
    ['one with the wrong shape', { body: { methods: 'many' } }, 'invalid'],
    ['one that is far too large', { rawBody: 'x'.repeat(MAX_RESPONSE_BYTES + 1) }, 'too-large'],
  ])('is refused: %s', async (_label, reply, failure) => {
    const connector = await connect(
      connectorDouble({ replies: { 'GET /v1/methods': () => reply as Reply } }),
    );

    const error = await rejection(connector.listMethods('BRL'));

    expect(error.failure).toBe(failure);
  });

  it('is an error that says the status, when the connector says it could not', async () => {
    const connector = await connect(
      connectorDouble({
        replies: { 'POST /v1/checkouts': () => ({ status: 502, body: { error: 'x' } }) },
      }),
    );

    const error = await rejection(
      connector.createCheckout({
        checkoutId: 'c1',
        payer: { userId: 'u', username: 'ana' },
        tier: { id: 't', name: 'Pro' },
        interval: 'monthly',
        amountCents: 1990,
        currency: 'BRL',
        methodId: 'card',
        language: 'pt',
      }),
    );

    expect(error.failure).toBe('status');
    expect(error.status).toBe(502);
  });
});

describe('when the connector cannot be reached', () => {
  it('is an error of its own, with no detail of the network in it', async () => {
    const error = await rejection(
      connect(
        connectorDouble({
          replies: { 'GET /v1/info': () => ({ fail: new Error('ECONNREFUSED 10.0.0.7:4000') }) },
        }),
      ),
    );

    expect(error.failure).toBe('transport');
    expect(error.message).not.toContain('10.0.0.7');
  });

  it('gives up after the time it was given', async () => {
    const slow = (async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as typeof fetch;

    const error = await rejection(
      HttpConnector.connect({
        baseUrl: 'https://connector.test',
        secrets: [KERES_KEY],
        timeoutMs: 30,
        fetchImpl: slow,
      }),
    );

    expect(error.failure).toBe('timeout');
    expect(error.message).toMatch(/30 ms/);
  });
});

describe('asking for the ways to pay', () => {
  it('signs the query it asks with, and passes on what the connector says, with `recurring`', async () => {
    const double = connectorDouble();
    const connector = await connect(double);

    const methods = await connector.listMethods('BRL');

    // The double predates `flow`: validation fills the redirect default.
    expect(methods).toEqual([
      { id: 'card', label: 'Card', flow: 'redirect' },
      { id: 'pix', label: 'PIX', recurring: false, flow: 'redirect' },
    ]);
    const request = double.seen.at(-1)!;
    expect(request).toMatchObject({
      method: 'GET',
      path: '/v1/methods?currency=BRL',
      verified: true,
    });
  });

  it('asks once for a while, and keeps the last list when the connector blinks', async () => {
    let now = Date.now();
    let down = false;
    const double = connectorDouble({
      replies: {
        'GET /v1/methods': () =>
          down
            ? { fail: new Error('down') }
            : { body: { methods: [{ id: 'card', label: 'Card' }] } },
      },
    });
    const connector = await connect(double, { now: () => now, methodsCacheMs: 1000 });

    await connector.listMethods('BRL');
    await connector.listMethods('BRL');
    expect(double.seen.filter((entry) => entry.path.startsWith('/v1/methods'))).toHaveLength(1);

    now += 2000;
    down = true;
    await expect(connector.listMethods('BRL')).resolves.toEqual([
      { id: 'card', label: 'Card', flow: 'redirect' },
    ]);
    // A currency it has never been asked about has nothing to fall back on.
    await expect(connector.listMethods('USD')).rejects.toBeInstanceOf(ConnectorError);
  });
});

describe('starting a payment', () => {
  const request = {
    checkoutId: 'c1',
    payer: { userId: 'u1', username: 'ana' },
    tier: { id: 't1', name: 'Pro' },
    interval: 'monthly' as const,
    amountCents: 1990,
    currency: 'BRL',
    methodId: 'card',
    language: 'pt',
  };

  it('sends the attempt, signed, with its id as the idempotency key, and gets what to do', async () => {
    const double = connectorDouble();
    const connector = await connect(double);

    const result = await connector.createCheckout(request);

    expect(result).toEqual({
      providerReference: 'ch_1',
      action: { kind: 'redirect', url: 'https://pay.acme.test/ch_1' },
      expiresAt: new Date('2026-04-03T10:00:00.000Z'),
    });
    const sent = double.seen.at(-1)!;
    expect(sent).toMatchObject({ method: 'POST', path: '/v1/checkouts', verified: true });
    expect(sent.headers.get('idempotency-key')).toBe('c1');
    expect(JSON.parse(sent.body)).toEqual(request);
  });

  it('is told nothing more than an id and a name of the person, and never a way to pay', async () => {
    const double = connectorDouble();
    const connector = await connect(double);

    await connector.createCheckout(request);

    const body = double.seen.at(-1)!.body;
    expect(body).not.toMatch(/card_?number|cvv|email|password/i);
    expect(Object.keys(JSON.parse(body).payer).sort()).toEqual(['userId', 'username']);
  });

  it('takes an answer with no expiry, and refuses an action that is not in the contract', async () => {
    const plain = await connect(
      connectorDouble({
        replies: {
          'POST /v1/checkouts': () => ({
            status: 201,
            body: { providerReference: 'ch_2', action: { kind: 'none' } },
          }),
        },
      }),
    );
    await expect(plain.createCheckout(request)).resolves.toEqual({
      providerReference: 'ch_2',
      action: { kind: 'none' },
    });

    const odd = await connect(
      connectorDouble({
        replies: {
          'POST /v1/checkouts': () => ({
            status: 201,
            body: { providerReference: 'ch_3', action: { kind: 'launch-missiles' } },
          }),
        },
      }),
    );
    expect((await rejection(odd.createCheckout(request))).failure).toBe('invalid');
  });
});

describe('the optional parts', () => {
  it('asks how an attempt ended, and turns the answer into an event with a date', async () => {
    const double = connectorDouble({
      replies: {
        'GET /v1/checkouts/c1': () => ({
          body: {
            event: {
              type: 'payment.succeeded',
              eventId: 'ch_1:paid',
              checkoutId: 'c1',
              subscriptionReference: 'sub_1',
              paidAt: '2026-03-03T10:00:00.000Z',
              amountCents: 1990,
              currency: 'brl',
            },
          },
        }),
      },
    });
    const connector = await connect(double);

    const event = await connector.getCheckoutStatus!('c1', 'ch/1');

    expect(event).toEqual({
      type: 'payment.succeeded',
      eventId: 'ch_1:paid',
      checkoutId: 'c1',
      subscriptionReference: 'sub_1',
      paidAt: new Date('2026-03-03T10:00:00.000Z'),
      amountCents: 1990,
      currency: 'BRL',
    });
    expect(double.seen.at(-1)).toMatchObject({
      path: '/v1/checkouts/c1?providerReference=ch%2F1',
      verified: true,
    });
  });

  it('says null while an attempt is still open', async () => {
    const connector = await connect(connectorDouble());

    await expect(connector.getCheckoutStatus!('c1', 'ch_1')).resolves.toBeNull();
  });

  it('cancels a subscription by its reference, which is written into the path safely', async () => {
    const double = connectorDouble({
      replies: { 'POST /v1/subscriptions/sub_1/cancel': () => ({ body: {} }) },
    });
    const connector = await connect(double);

    await connector.cancelSubscription!('sub_1');
    await expect(connector.cancelSubscription!('../../v1/info')).rejects.toBeInstanceOf(
      ConnectorError,
    );

    expect(
      double.seen.find((entry) => entry.path === '/v1/subscriptions/sub_1/cancel'),
    ).toMatchObject({
      method: 'POST',
      verified: true,
    });
    // The odd reference went into one path segment, not into a way to another route.
    expect(double.seen.at(-1)!.path).toBe('/v1/subscriptions/..%2F..%2Fv1%2Finfo/cancel');
  });

  it('tells it a period passed unpaid, with the date as text and nothing of the person but an id and a name', async () => {
    const double = connectorDouble();
    const connector = await connect(double);

    await connector.onSubscriptionDue!({
      payer: { userId: 'u1', username: 'ana' },
      tier: { id: 't1', name: 'Pro' },
      interval: 'monthly',
      amountCents: 1990,
      currency: 'BRL',
      subscriptionReference: 'sub_1',
      paidUntil: new Date('2026-04-03T10:00:00.000Z'),
    });

    const sent = double.seen.at(-1)!;
    expect(sent).toMatchObject({ method: 'POST', path: '/v1/subscriptions/due', verified: true });
    expect(JSON.parse(sent.body).paidUntil).toBe('2026-04-03T10:00:00.000Z');
  });
});

describe('a key being replaced', () => {
  it('signs with the new key and still accepts an answer signed with the previous one', async () => {
    const double = connectorDouble({
      replies: { 'GET /v1/methods': () => ({ body: { methods: [] }, key: OLD_KEY }) },
    });
    const connector = await connect(double, { secrets: [KERES_KEY, OLD_KEY] });

    await expect(connector.listMethods('BRL')).resolves.toEqual([]);
  });

  it('does not accept an answer signed with a key it was not given', async () => {
    const double = connectorDouble({
      replies: { 'GET /v1/methods': () => ({ body: { methods: [] }, key: OLD_KEY }) },
    });
    const connector = await connect(double, { secrets: [KERES_KEY] });

    expect((await rejection(connector.listMethods('BRL'))).failure).toBe('signature');
  });
});

describe('the headers it sends', () => {
  it('sends only what the contract names, and nothing that could carry a credential of Keres', async () => {
    const double = connectorDouble();
    await connect(double);

    const names = [...double.seen[0].headers.keys()].sort();

    expect(names).toEqual(['accept', HEADER_NONCE, HEADER_SIGNATURE, HEADER_TIMESTAMP].sort());
    expect(vi.isMockFunction(double.fetchImpl)).toBe(false);
  });
});

describe('checking a store purchase', () => {
  const verified = {
    userId: 'user-1',
    packageName: 'com.test.app',
    productId: 'plus_monthly',
    purchaseToken: 'token-abc',
    purchaseKind: 'subscription' as const,
    amountCents: 1990,
    currency: 'BRL',
    checkoutId: 'checkout-1',
  };
  const seen: { url: string; init?: RequestInit }[] = [];

  /** The signed double answers `/v1/info`; the store endpoint answers plainly, behind its own key. */
  const playFetch = (answer: unknown, status = 200) => {
    const double = connectorDouble();
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/play/verify')) {
        seen.push({ url, init });
        return new Response(JSON.stringify(answer), { status });
      }
      return double.fetchImpl(input, init);
    }) as typeof fetch;
  };

  it('asks with the play key and reads whether the token is real', async () => {
    seen.length = 0;
    const connector = await HttpConnector.connect({
      baseUrl: 'https://connector.test/pay-base',
      secrets: [KERES_KEY],
      timeoutMs: 2000,
      fetchImpl: playFetch({ ok: true, active: true, orderId: 'GPA.1234' }),
      playSecret: 'play-secret-0123456789abcdef-00',
    });

    const answer = await connector.verifyPlayPurchase!(verified);

    expect(answer).toEqual({ active: true, orderId: 'GPA.1234' });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe('https://connector.test/pay-base/v1/play/verify');
    const headers = new Headers(seen[0].init?.headers);
    expect(headers.get('authorization')).toBe('Bearer play-secret-0123456789abcdef-00');
    expect(JSON.parse(String(seen[0].init?.body))).toMatchObject({
      purchaseToken: 'token-abc',
      checkoutId: 'checkout-1',
      amountCents: 1990,
    });
  });

  it('does not speak the store endpoint without the play key', async () => {
    const connector = await connect(connectorDouble());

    expect(connector.verifyPlayPurchase).toBeUndefined();
  });

  it('refuses a denial and an answer outside the contract', async () => {
    const denied = await HttpConnector.connect({
      baseUrl: 'https://connector.test/pay-base',
      secrets: [KERES_KEY],
      timeoutMs: 2000,
      fetchImpl: playFetch({ message: 'Refused.' }, 401),
      playSecret: 'play-secret-0123456789abcdef-00',
    });
    const refusal = await rejection(denied.verifyPlayPurchase!(verified));
    expect(refusal.failure).toBe('status');
    expect(refusal.status).toBe(401);

    const garbled = await HttpConnector.connect({
      baseUrl: 'https://connector.test/pay-base',
      secrets: [KERES_KEY],
      timeoutMs: 2000,
      fetchImpl: playFetch({ ok: true }),
      playSecret: 'play-secret-0123456789abcdef-00',
    });
    // `active` missing: not what the contract says.
    const invalid = await rejection(garbled.verifyPlayPurchase!(verified));
    expect(invalid.failure).toBe('invalid');
  });
});
