import { createSign } from 'node:crypto';
import type { PaymentsConfig } from './config';
import type { PaymentMethodOption, PaymentEventWire } from './wire';

/**
 * Google Play Billing, verified server-side. The Play Store policy requires digital goods in
 * apps to be sold through Google Play Billing - not through a web checkout - so the mobile
 * app buys with the Play SDK and sends the purchase token here; this module asks Google
 * whether that token is a real, paid, acknowledged purchase and, when it is, reports it to
 * Keres as `payment.succeeded` (renewals arrive the same way, each validated again).
 */

export interface PlayVerifyRequest {
  userId: string;
  packageName: string;
  productId: string;
  purchaseToken: string;
  purchaseKind: 'inapp' | 'subscription';
  amountCents: number;
  currency: string;
  checkoutId?: string;
}

export interface PlayConfig {
  serviceAccountJson: string;
  mock: boolean;
}

export interface PlayVerification {
  orderId: string;
  active: boolean;
}

/** The store method id the Android app pays with. */
export const PLAY_BILLING_METHOD_ID = 'playbilling';

/**
 * The Play Store method for `GET /v1/methods`. It is not a provider: the purchase happens in the
 * app through the Play SDK and only the token is verified here, so it never answers checkouts -
 * it is listed so clients know the server sells through Google Play. Listed only while Play
 * verification is configured; anywhere else the server has no Play goods to sell.
 */
export function playBillingMethods(
  play: PaymentsConfig['play'],
  currency: string,
): PaymentMethodOption[] {
  if (!play || !/^[A-Z]{3}$/.test(currency)) return [];
  return [
    {
      id: PLAY_BILLING_METHOD_ID,
      label: 'Google Play',
      description: 'Pay inside the Android app through Google Play.',
      recurring: true,
      flow: 'native',
      store: 'play',
    },
  ];
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** OAuth2 access token for the Android Publisher API, from a service-account key. */
export async function googleAccessToken(
  serviceAccountJson: string,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<string> {
  const account = JSON.parse(serviceAccountJson) as {
    client_email?: string;
    private_key?: string;
  };
  if (!account.client_email || !account.private_key) {
    throw new Error('The Play service account needs client_email and private_key.');
  }
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      exp: Math.floor(now / 1000) + 3600,
      iat: Math.floor(now / 1000),
    }),
  );
  const signature = base64url(
    createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key),
  );
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }).toString(),
  });
  if (!response.ok) throw new Error(`Google refused the service account (${response.status}).`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Google answered without an access token.');
  return data.access_token;
}

/** Asks Google about one purchase token. Anything unpaid, cancelled or unknown is not active. */
export async function verifyPlayPurchase(
  config: PlayConfig,
  request: PlayVerifyRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<PlayVerification> {
  if (config.mock) {
    return { orderId: `mock-${request.purchaseToken}`, active: true };
  }
  const access = await googleAccessToken(config.serviceAccountJson, fetchImpl);
  const headers = { authorization: `Bearer ${access}` };
  const base = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
  if (request.purchaseKind === 'subscription') {
    const response = await fetchImpl(
      `${base}/${encodeURIComponent(request.packageName)}/purchases/subscriptionsv2/${encodeURIComponent(request.purchaseToken)}`,
      { headers },
    );
    if (response.status === 404) return { orderId: '', active: false };
    if (!response.ok) throw new Error(`Google Play answered ${response.status}.`);
    const data = (await response.json()) as {
      subscriptionState?: string;
      currentOrderId?: string;
      lineItems?: { productId?: string }[];
    };
    // The store still entitles a subscription in its grace period (the renewal failed but Play
    // keeps retrying it), so grace counts as paid here too - denying it would cut off someone the
    // store still considers in good standing. Anything else unpaid, held or dead is not active.
    if (
      data.subscriptionState !== 'SUBSCRIPTION_STATE_ACTIVE' &&
      data.subscriptionState !== 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
    ) {
      return { orderId: data.currentOrderId ?? '', active: false };
    }
    // The token must really be for the product being bought: a token for a cheaper product with the
    // expensive product's id would otherwise pass (the endpoint's path carries no product for
    // subscriptions, unlike one-time purchases where it does).
    if (!(data.lineItems ?? []).some((item) => item.productId === request.productId)) {
      return { orderId: data.currentOrderId ?? '', active: false };
    }
    return { orderId: data.currentOrderId ?? request.purchaseToken, active: true };
  }
  const response = await fetchImpl(
    `${base}/${encodeURIComponent(request.packageName)}/purchases/products/${encodeURIComponent(request.productId)}/tokens/${encodeURIComponent(request.purchaseToken)}`,
    { headers },
  );
  if (response.status === 404) return { orderId: '', active: false };
  if (!response.ok) throw new Error(`Google Play answered ${response.status}.`);
  const data = (await response.json()) as { purchaseState?: number; orderId?: string };
  if (data.purchaseState !== 0) return { orderId: data.orderId ?? '', active: false };
  return { orderId: data.orderId ?? request.purchaseToken, active: true };
}

export function playSucceededEvent(request: PlayVerifyRequest, orderId: string): PaymentEventWire {
  return {
    type: 'payment.succeeded',
    eventId: orderId,
    ...(request.checkoutId ? { checkoutId: request.checkoutId } : {}),
    ...(request.purchaseKind === 'subscription'
      ? { subscriptionReference: request.purchaseToken }
      : {}),
    paidAt: new Date().toISOString(),
    amountCents: request.amountCents,
    currency: request.currency,
  };
}
