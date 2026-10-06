import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { playNotificationEvents, verifyPlayPurchase } from '../src/playbilling';
import { createApp, createState } from '../src/routes';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const live = {
  serviceAccountJson: JSON.stringify({
    client_email: 'a@b.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  }),
  mock: false,
};

const EVENT_TIME = 1_790_000_000_000;

function push(notification: Record<string, unknown>, messageId = 'msg-1') {
  return {
    message: {
      data: Buffer.from(JSON.stringify(notification)).toString('base64'),
      messageId,
    },
  };
}

const subscriptionNotice = (notificationType: number, messageId?: string) =>
  push(
    {
      version: '1.0',
      packageName: 'me.keres.app',
      eventTimeMillis: String(EVENT_TIME),
      subscriptionNotification: {
        version: '1.0',
        notificationType,
        purchaseToken: 'token-abc',
        subscriptionId: 'plus_monthly',
      },
    },
    messageId,
  );

const ACTIVE = {
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  currentOrderId: 'GPA.1234-5678-9012-34567..1',
  lineItems: [
    {
      productId: 'plus_monthly',
      autoRenewingPlan: {
        recurringPrice: { currencyCode: 'BRL', units: '25', nanos: 900_000_000 },
      },
    },
  ],
};

/** Google as the service sees it: the token endpoint, then one answer for the purchase. */
function googleSays(subscription: Record<string, unknown>): typeof fetch {
  return (async (url: string | URL | Request) => {
    if (String(url).includes('oauth2.googleapis.com')) {
      return new Response(JSON.stringify({ access_token: 'google-tok' }));
    }
    return new Response(JSON.stringify(subscription));
  }) as typeof fetch;
}

describe('Play: what Google charges per period', () => {
  it('reads the recurring price in minor units', async () => {
    const verification = await verifyPlayPurchase(
      live,
      {
        packageName: 'me.keres.app',
        productId: 'plus_monthly',
        purchaseToken: 'token-abc',
        purchaseKind: 'subscription',
      },
      googleSays(ACTIVE),
    );
    expect(verification).toEqual({
      orderId: 'GPA.1234-5678-9012-34567..1',
      active: true,
      recurringPrice: { amountCents: 2590, currency: 'BRL' },
    });
  });
});

describe('Play real-time notifications', () => {
  it('turns a renewal into the payment Google made, named by its order', async () => {
    const events = await playNotificationEvents(live, subscriptionNotice(2), googleSays(ACTIVE));
    expect(events).toEqual([
      {
        type: 'payment.succeeded',
        eventId: 'GPA.1234-5678-9012-34567..1',
        subscriptionReference: 'token-abc',
        paidAt: new Date(EVENT_TIME).toISOString(),
        amountCents: 2590,
        currency: 'BRL',
      },
    ]);
  });

  it('reports a recovery from a payment hold the same way', async () => {
    const events = await playNotificationEvents(live, subscriptionNotice(1), googleSays(ACTIVE));
    expect(events).toHaveLength(1);
  });

  it('reports nothing when Google no longer calls the subscription paid', async () => {
    const held = { ...ACTIVE, subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD' };
    expect(await playNotificationEvents(live, subscriptionNotice(2), googleSays(held))).toEqual([]);
  });

  it('fails, to be delivered again, when Google does not say what was charged', async () => {
    const noPrice = { ...ACTIVE, lineItems: [{ productId: 'plus_monthly' }] };
    await expect(
      playNotificationEvents(live, subscriptionNotice(2), googleSays(noPrice)),
    ).rejects.toThrow('what was charged');
  });

  it("ends the subscription at the store's cancel, expiry or refund, once per delivery", async () => {
    const never = googleSays({});
    for (const type of [3, 12, 13]) {
      const [event] = await playNotificationEvents(live, subscriptionNotice(type, 'msg-7'), never);
      expect(event).toMatchObject({
        type: 'subscription.canceled',
        subscriptionReference: 'token-abc',
      });
      const [again] = await playNotificationEvents(live, subscriptionNotice(type, 'msg-7'), never);
      expect(again.eventId).toBe(event.eventId);
    }
    const [cancel] = await playNotificationEvents(live, subscriptionNotice(3, 'msg-1'), never);
    const [expiry] = await playNotificationEvents(live, subscriptionNotice(13, 'msg-1'), never);
    expect(cancel.eventId).not.toBe(expiry.eventId);
  });

  it('ignores what it does not act on, and what it cannot read', async () => {
    const never = googleSays({});
    // On hold, grace period, paused, a test ping, a first purchase (the app relays that one).
    for (const type of [4, 5, 6, 10]) {
      expect(await playNotificationEvents(live, subscriptionNotice(type), never)).toEqual([]);
    }
    expect(
      await playNotificationEvents(
        live,
        push({ packageName: 'me.keres.app', testNotification: {} }),
        never,
      ),
    ).toEqual([]);
    expect(await playNotificationEvents(live, { not: 'a push' }, never)).toEqual([]);
    expect(
      await playNotificationEvents(live, { message: { data: 'not base64 json' } }, never),
    ).toEqual([]);
  });
});

describe('Play notification endpoint', () => {
  const SECRET = 'push-secret-0123456789abcdef-0000';

  function app(env: Record<string, string> = {}) {
    const config = loadConfig({
      KERES_CONNECTOR_SECRET: 'connector-secret-0123456789abcdef',
      KERES_BASE_URL: 'http://127.0.0.1:3000',
      KERES_EVENTS_SECRET: 'events-secret-0123456789abcdef-00',
      PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
      PLAY_ENDPOINT_SECRET: 'play-secret-0123456789abcdef-0000',
      PLAY_MOCK: 'true',
      ...env,
    } as NodeJS.ProcessEnv);
    const report = vi.fn(async () => undefined);
    return { app: createApp(createState(config, { providers: [], report })), report };
  }

  const post = (token: string | null, body: unknown) =>
    new Request(
      `http://127.0.0.1:3101/v1/play/notifications${token === null ? '' : `?token=${token}`}`,
      { method: 'POST', body: JSON.stringify(body) },
    );

  it('is off until a notification secret is set', async () => {
    const { app: off } = app();
    expect((await off.fetch(post(SECRET, subscriptionNotice(3)))).status).toBe(404);
  });

  it('refuses a push without the right secret', async () => {
    const { app: on, report } = app({ PLAY_NOTIFICATION_SECRET: SECRET });
    expect((await on.fetch(post(null, subscriptionNotice(3)))).status).toBe(401);
    expect((await on.fetch(post('x'.repeat(SECRET.length), subscriptionNotice(3)))).status).toBe(
      401,
    );
    expect(report).not.toHaveBeenCalled();
  });

  it('reports what the push stands for to Keres', async () => {
    const { app: on, report } = app({ PLAY_NOTIFICATION_SECRET: SECRET });
    const response = await on.fetch(post(SECRET, subscriptionNotice(3, 'msg-9')));
    expect(response.status).toBe(200);
    expect(report).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'subscription.canceled',
        subscriptionReference: 'token-abc',
      }),
    ]);
  });

  it('answers 200 to what is not ours to read (no endless redelivery) and 502 when Keres is down', async () => {
    const { app: on, report } = app({ PLAY_NOTIFICATION_SECRET: SECRET });
    expect((await on.fetch(post(SECRET, { garbage: true }))).status).toBe(200);
    expect(report).not.toHaveBeenCalled();

    report.mockRejectedValueOnce(new Error('Keres refused the events push (500).'));
    expect((await on.fetch(post(SECRET, subscriptionNotice(3)))).status).toBe(502);
  });

  it('keeps the verify endpoint behind its own bearer', async () => {
    const { app: on } = app({ PLAY_NOTIFICATION_SECRET: SECRET });
    const verify = (authorization: string) =>
      on.fetch(
        new Request('http://127.0.0.1:3101/v1/play/verify', {
          method: 'POST',
          headers: { authorization },
          body: JSON.stringify({}),
        }),
      );
    expect((await verify('Bearer wrong')).status).toBe(401);
    expect((await verify('')).status).toBe(401);
    // Right bearer, empty body: past the door, refused as a bad request.
    expect((await verify('Bearer play-secret-0123456789abcdef-0000')).status).toBe(400);
  });
});
