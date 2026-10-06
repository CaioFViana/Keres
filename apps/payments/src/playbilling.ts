import { createHash, createSign } from 'node:crypto';
import { z } from 'zod';
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

/** What identifies a purchase at the store: enough to ask Google about it. */
export type PlayLookup = Pick<
  PlayVerifyRequest,
  'packageName' | 'productId' | 'purchaseToken' | 'purchaseKind'
>;

export interface PlayVerification {
  orderId: string;
  active: boolean;
  /** What Google charges each period, when it says so (auto-renewing subscriptions). */
  recurringPrice?: { amountCents: number; currency: string };
}

interface PlayLineItem {
  productId?: string;
  autoRenewingPlan?: {
    recurringPrice?: { currencyCode?: string; units?: string; nanos?: number };
  };
}

function recurringPriceOf(item: PlayLineItem): PlayVerification['recurringPrice'] {
  const price = item.autoRenewingPlan?.recurringPrice;
  const units = Number(price?.units ?? '0');
  if (!price?.currencyCode || !/^[A-Z]{3}$/.test(price.currencyCode) || !Number.isFinite(units)) {
    return undefined;
  }
  // Money in the API is whole units plus nanos (1e-9); the rest of the system speaks minor units.
  return {
    amountCents: Math.round(units * 100 + (price.nanos ?? 0) / 10_000_000),
    currency: price.currencyCode,
  };
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
  request: PlayLookup & Partial<PlayVerifyRequest>,
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
      lineItems?: PlayLineItem[];
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
    const line = (data.lineItems ?? []).find((item) => item.productId === request.productId);
    if (!line) return { orderId: data.currentOrderId ?? '', active: false };
    const recurringPrice = recurringPriceOf(line);
    return {
      orderId: data.currentOrderId ?? request.purchaseToken,
      active: true,
      ...(recurringPrice ? { recurringPrice } : {}),
    };
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

/**
 * Google's real-time developer notifications, pushed through Pub/Sub. They are how a renewal (or a
 * cancellation made in the Play Store) reaches Keres without the person opening the app: the
 * purchase token is only ever relayed at purchase time, and nothing else tells us the store charged
 * again. Each push is checked against Google before anything is reported - the message itself is
 * only a pointer, never proof.
 */
const NOTIFICATION = { RECOVERED: 1, RENEWED: 2, CANCELED: 3, REVOKED: 12, EXPIRED: 13 } as const;

const PushEnvelopeSchema = z.object({
  message: z.object({
    data: z.string().min(1).max(32_768),
    messageId: z.string().max(100).optional(),
  }),
});

const DeveloperNotificationSchema = z.object({
  packageName: z.string().min(1).max(200),
  eventTimeMillis: z.union([z.string(), z.number()]).optional(),
  subscriptionNotification: z
    .object({
      notificationType: z.number().int(),
      purchaseToken: z.string().min(1).max(1000),
      subscriptionId: z.string().min(1).max(200),
    })
    .optional(),
});

/** The events one Pub/Sub push stands for. Empty for what Keres does not act on (holds, pauses, tests). */
export async function playNotificationEvents(
  config: PlayConfig,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<PaymentEventWire[]> {
  const envelope = PushEnvelopeSchema.safeParse(body);
  if (!envelope.success) return [];
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(envelope.data.message.data, 'base64').toString('utf8'));
  } catch {
    return [];
  }
  const parsed = DeveloperNotificationSchema.safeParse(decoded);
  const notice = parsed.success ? parsed.data.subscriptionNotification : undefined;
  if (!parsed.success || !notice) return [];
  const { packageName } = parsed.data;
  const { purchaseToken, subscriptionId } = notice;
  const at = Number(parsed.data.eventTimeMillis);
  const happenedAt = new Date(Number.isFinite(at) && at > 0 ? at : Date.now()).toISOString();

  switch (notice.notificationType) {
    case NOTIFICATION.RENEWED:
    case NOTIFICATION.RECOVERED: {
      const verification = await verifyPlayPurchase(
        config,
        { packageName, productId: subscriptionId, purchaseToken, purchaseKind: 'subscription' },
        fetchImpl,
      );
      // Held, paused or already over by the time we looked: nothing was paid.
      if (!verification.active) return [];
      // The charge is whatever Google says it was; an answer without it cannot be reported honestly,
      // and a thrown error makes Pub/Sub deliver the notice again.
      if (!verification.recurringPrice) {
        throw new Error('Google Play did not say what was charged.');
      }
      return [
        {
          type: 'payment.succeeded',
          // The order id is the event id: the same order reported by the relay (the person opening the
          // app) and by this push is one payment, never two.
          eventId: verification.orderId,
          subscriptionReference: purchaseToken,
          paidAt: happenedAt,
          amountCents: verification.recurringPrice.amountCents,
          currency: verification.recurringPrice.currency,
        },
      ];
    }
    // Cancelled in the store (access runs to the end of the paid period), expired or refunded: the
    // subscription stops renewing and ends with the period Keres already holds.
    case NOTIFICATION.CANCELED:
    case NOTIFICATION.REVOKED:
    case NOTIFICATION.EXPIRED: {
      const tokenHash = createHash('sha256').update(purchaseToken).digest('hex').slice(0, 24);
      const delivery = envelope.data.message.messageId ?? happenedAt;
      return [
        {
          type: 'subscription.canceled',
          eventId: `play-${notice.notificationType}-${delivery}-${tokenHash}`,
          subscriptionReference: purchaseToken,
        },
      ];
    }
    default:
      return [];
  }
}
