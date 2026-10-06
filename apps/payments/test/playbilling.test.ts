import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import {
  PLAY_BILLING_METHOD_ID,
  playBillingMethods,
  playSucceededEvent,
  verifyPlayPurchase,
} from '../src/playbilling';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const serviceAccount = JSON.stringify({
  client_email: 'a@b.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});

describe('Play Billing verification', () => {
  it('accepts anything in mock mode, for homologation only', async () => {
    const verification = await verifyPlayPurchase(
      { serviceAccountJson: '', mock: true },
      {
        userId: 'user-1',
        packageName: 'me.keres.app',
        productId: 'plus_monthly',
        purchaseToken: 'token-abc',
        purchaseKind: 'subscription',
        amountCents: 2500,
        currency: 'BRL',
      },
    );

    expect(verification).toEqual({ orderId: 'mock-token-abc', active: true });
  });

  it('asks Google about one-time purchases when live', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url));
      if (String(url).includes('oauth2.googleapis.com')) {
        return new Response(JSON.stringify({ access_token: 'google-tok' }));
      }
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer google-tok');
      return new Response(JSON.stringify({ purchaseState: 0, orderId: 'GPA.1234' }));
    }) as typeof fetch;

    const verification = await verifyPlayPurchase(
      { serviceAccountJson: serviceAccount, mock: false },
      {
        userId: 'user-1',
        packageName: 'me.keres.app',
        productId: 'plus_monthly',
        purchaseToken: 'token-abc',
        purchaseKind: 'inapp',
        amountCents: 2500,
        currency: 'BRL',
      },
      fetchImpl,
    );

    expect(verification).toEqual({ orderId: 'GPA.1234', active: true });
    expect(
      calls.some((call) => call.includes('/purchases/products/plus_monthly/tokens/token-abc')),
    ).toBe(true);
  });

  it('accepts a live subscription only for the product being bought', async () => {
    const live = (lineItems: { productId?: string }[]) =>
      (async (url: string | URL | Request) => {
        if (String(url).includes('oauth2.googleapis.com')) {
          return new Response(JSON.stringify({ access_token: 'google-tok' }));
        }
        return new Response(
          JSON.stringify({
            subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
            currentOrderId: 'GPA.1234',
            lineItems,
          }),
        );
      }) as typeof fetch;
    const request = {
      userId: 'user-1',
      packageName: 'me.keres.app',
      productId: 'plus_monthly',
      purchaseToken: 'token-abc',
      purchaseKind: 'subscription' as const,
      amountCents: 2500,
      currency: 'BRL',
    };

    const good = await verifyPlayPurchase(
      { serviceAccountJson: serviceAccount, mock: false },
      request,
      live([{ productId: 'plus_monthly' }]),
    );
    expect(good).toEqual({ orderId: 'GPA.1234', active: true });

    // A token for another product with this product's id is not this purchase.
    const wrong = await verifyPlayPurchase(
      { serviceAccountJson: serviceAccount, mock: false },
      request,
      live([{ productId: 'basic_monthly' }]),
    );
    expect(wrong.active).toBe(false);
  });

  it('counts a grace-period subscription as paid, and held or dead ones as not', async () => {
    const live = (subscriptionState: string) =>
      (async (url: string | URL | Request) => {
        if (String(url).includes('oauth2.googleapis.com')) {
          return new Response(JSON.stringify({ access_token: 'google-tok' }));
        }
        return new Response(
          JSON.stringify({
            subscriptionState,
            currentOrderId: 'GPA.1234',
            lineItems: [{ productId: 'plus_monthly' }],
          }),
        );
      }) as typeof fetch;
    const request = {
      userId: 'user-1',
      packageName: 'me.keres.app',
      productId: 'plus_monthly',
      purchaseToken: 'token-abc',
      purchaseKind: 'subscription' as const,
      amountCents: 2500,
      currency: 'BRL',
    };
    const config = { serviceAccountJson: serviceAccount, mock: false };

    // The store still entitles grace: the renewal failed but Play keeps retrying it.
    const grace = await verifyPlayPurchase(
      config,
      request,
      live('SUBSCRIPTION_STATE_IN_GRACE_PERIOD'),
    );
    expect(grace).toEqual({ orderId: 'GPA.1234', active: true });

    for (const state of [
      'SUBSCRIPTION_STATE_ON_HOLD',
      'SUBSCRIPTION_STATE_PAUSED',
      'SUBSCRIPTION_STATE_CANCELLED',
      'SUBSCRIPTION_STATE_EXPIRED',
    ]) {
      const dead = await verifyPlayPurchase(config, request, live(state));
      expect(dead.active).toBe(false);
    }
  });

  it('treats cancelled or unknown purchases as inactive', async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).includes('oauth2.googleapis.com')) {
        return new Response(JSON.stringify({ access_token: 'google-tok' }));
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as typeof fetch;

    const verification = await verifyPlayPurchase(
      { serviceAccountJson: serviceAccount, mock: false },
      {
        userId: 'user-1',
        packageName: 'me.keres.app',
        productId: 'plus_monthly',
        purchaseToken: 'token-gone',
        purchaseKind: 'inapp',
        amountCents: 2500,
        currency: 'BRL',
      },
      fetchImpl,
    );

    expect(verification.active).toBe(false);
  });

  it('builds the Keres event with the subscription reference for renewals', () => {
    const event = playSucceededEvent(
      {
        userId: 'user-1',
        packageName: 'me.keres.app',
        productId: 'plus_monthly',
        purchaseToken: 'token-abc',
        purchaseKind: 'subscription',
        amountCents: 2500,
        currency: 'BRL',
      },
      'GPA.1234',
    );

    expect(event).toMatchObject({
      type: 'payment.succeeded',
      eventId: 'GPA.1234',
      subscriptionReference: 'token-abc',
      amountCents: 2500,
      currency: 'BRL',
    });
  });

  it('requires the Play endpoint secret to exist before enabling', () => {
    const config = loadConfig({
      KERES_CONNECTOR_SECRET: 'connector-secret-0123456789abcdef',
      KERES_BASE_URL: 'http://127.0.0.1:3000',
      KERES_EVENTS_SECRET: 'events-secret-0123456789abcdef-00',
      PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
    } as NodeJS.ProcessEnv);
    expect(config.play).toBeNull();
  });
});

describe('Play Billing store method', () => {
  const play = {
    endpointSecret: 'play-secret-0123456789abcdef-0000',
    mock: true,
    notificationSecret: null,
  };

  it('lists the native Play method while Play verification is configured', () => {
    expect(playBillingMethods(play, 'BRL')).toEqual([
      {
        id: PLAY_BILLING_METHOD_ID,
        label: 'Google Play',
        description: 'Pay inside the Android app through Google Play.',
        recurring: true,
        flow: 'native',
        store: 'play',
      },
    ]);
  });

  it('lists nothing without Play configuration or with a bad currency', () => {
    expect(playBillingMethods(null, 'BRL')).toEqual([]);
    expect(playBillingMethods(play, 'XX')).toEqual([]);
  });
});
