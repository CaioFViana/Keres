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
  /** The app's package: the only one a purchase may name, and the one a cancellation is sent for. */
  packageName?: string | null;
  /** Whether a license tester's purchase counts as paid (homologation only). */
  acceptTestPurchases?: boolean;
}

const PLAY_API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

/** What `subscriptionsv2.get` answers that is read here. */
interface PlaySubscriptionData {
  subscriptionState?: string;
  lineItems?: PlayLineItem[];
  /** Present only for a purchase by a license tester. */
  testPurchase?: object;
}

/** The subscription as Google describes it; `null` when Google does not know the token. */
async function playSubscription(
  config: PlayConfig,
  packageName: string,
  purchaseToken: string,
  fetchImpl: typeof fetch,
): Promise<PlaySubscriptionData | null> {
  const access = await googleAccessToken(config.serviceAccountJson, fetchImpl);
  const response = await fetchImpl(
    `${PLAY_API}/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { authorization: `Bearer ${access}` } },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Google Play answered ${response.status}.`);
  return (await response.json()) as PlaySubscriptionData;
}

/**
 * Stops a store subscription renewing, at the store: the person keeps what they paid for until its end and can
 * restore it in the Play Store (`USER_REQUESTED_STOP_RENEWALS`). One that is already cancelled or over is the goal
 * reached. Needs the app's package (`PLAY_PACKAGE_NAME`): a cancellation names only the token.
 */
export async function cancelPlaySubscription(
  config: PlayConfig,
  purchaseToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (config.mock) return;
  const packageName = config.packageName;
  if (!packageName) throw new PlayCancelUnsupported();
  const current = await playSubscription(config, packageName, purchaseToken, fetchImpl);
  if (!current) throw new Error('Google Play does not know that purchase.');
  if (
    current.subscriptionState === 'SUBSCRIPTION_STATE_CANCELED' ||
    current.subscriptionState === 'SUBSCRIPTION_STATE_EXPIRED'
  ) {
    return;
  }
  const access = await googleAccessToken(config.serviceAccountJson, fetchImpl);
  const response = await fetchImpl(
    `${PLAY_API}/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}:cancel`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        cancellationContext: { cancellationType: 'USER_REQUESTED_STOP_RENEWALS' },
      }),
    },
  );
  if (!response.ok)
    throw new Error(`Google Play did not cancel the subscription (${response.status}).`);
}

/** The service cannot cancel store subscriptions: the app's package was not set. */
export class PlayCancelUnsupported extends Error {
  constructor() {
    super('Cancellation is not supported for this subscription.');
    this.name = 'PlayCancelUnsupported';
  }
}

/** What identifies a purchase at the store: enough to ask Google about it. */
export type PlayLookup = Pick<
  PlayVerifyRequest,
  'packageName' | 'purchaseToken' | 'purchaseKind'
> & {
  /**
   * The product being bought. The relay names it and it is checked against the purchase; a store notification
   * carries only the token, so there the purchase's own product is taken as it is.
   */
  productId?: string;
};

export interface PlayVerification {
  orderId: string;
  active: boolean;
  /** What Google charges each period, when it says so (auto-renewing subscriptions). */
  recurringPrice?: { amountCents: number; currency: string };
}

interface PlayLineItem {
  productId?: string;
  /** The order of the latest successful charge of this item; absent while the user does not own it yet. */
  latestSuccessfulOrderId?: string;
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
  // The app this service sells for is the only one a purchase may name: Google is not even asked about others.
  if (config.packageName && request.packageName !== config.packageName) {
    return { orderId: '', active: false };
  }
  if (request.purchaseKind === 'subscription') {
    const data = await playSubscription(
      config,
      request.packageName,
      request.purchaseToken,
      fetchImpl,
    );
    if (!data) return { orderId: '', active: false };
    // The store still entitles a subscription in its grace period (the renewal failed but Play
    // keeps retrying it), so grace counts as paid here too - denying it would cut off someone the
    // store still considers in good standing. Anything else unpaid, held or dead is not active.
    if (
      data.subscriptionState !== 'SUBSCRIPTION_STATE_ACTIVE' &&
      data.subscriptionState !== 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
    ) {
      return { orderId: '', active: false };
    }
    // A license tester's purchase is no money: it is not a payment unless homologation says so.
    if (data.testPurchase && !config.acceptTestPurchases) {
      return { orderId: '', active: false };
    }
    // The token must really be for the product being bought: a token for a cheaper product with the
    // expensive product's id would otherwise pass (the endpoint's path carries no product for
    // subscriptions, unlike one-time purchases where it does). A notification names no product, and
    // its purchase is taken as the store describes it.
    const items = data.lineItems ?? [];
    const line = request.productId
      ? items.find((item) => item.productId === request.productId)
      : items[0];
    // No order yet means the person does not own it: nothing was paid. The order id is what names the
    // payment, so one that is missing is never made up (the token would make every renewal "the same payment").
    if (!line?.latestSuccessfulOrderId) return { orderId: '', active: false };
    const recurringPrice = recurringPriceOf(line);
    return {
      orderId: line.latestSuccessfulOrderId,
      active: true,
      ...(recurringPrice ? { recurringPrice } : {}),
    };
  }
  const access = await googleAccessToken(config.serviceAccountJson, fetchImpl);
  const headers = { authorization: `Bearer ${access}` };
  const base = PLAY_API;
  if (!request.productId) throw new Error('A one-time purchase is checked by its product.');
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
  const { purchaseToken } = notice;
  // A notification for another app (the topic can be shared) is none of this service's business.
  if (config.packageName && packageName !== config.packageName) return [];
  const at = Number(parsed.data.eventTimeMillis);
  const happenedAt = new Date(Number.isFinite(at) && at > 0 ? at : Date.now()).toISOString();

  switch (notice.notificationType) {
    case NOTIFICATION.RENEWED:
    case NOTIFICATION.RECOVERED: {
      const verification = await verifyPlayPurchase(
        config,
        { packageName, purchaseToken, purchaseKind: 'subscription' },
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
    // Taken back by the store before it ended (a refund, a chargeback): the money went back, and the period it
    // paid for ends now.
    case NOTIFICATION.REVOKED: {
      const tokenHash = createHash('sha256').update(purchaseToken).digest('hex').slice(0, 24);
      const delivery = envelope.data.message.messageId ?? happenedAt;
      // What was charged, as far as Google still says it; a revoked purchase keeps its plan's price.
      let price: PlayVerification['recurringPrice'];
      try {
        const data = await playSubscription(config, packageName, purchaseToken, fetchImpl);
        const line = data?.lineItems?.[0];
        price = line ? recurringPriceOf(line) : undefined;
      } catch {
        price = undefined;
      }
      return [
        {
          type: 'payment.refunded',
          eventId: `play-revoked-${delivery}-${tokenHash}`,
          subscriptionReference: purchaseToken,
          refundedAt: happenedAt,
          // Google does not date the charge it revoked; the latest one is what a revocation takes back.
          chargedAt: happenedAt,
          amountCents: price?.amountCents ?? 0,
          // ISO 4217 "no currency": the amount is not known, only that the purchase was revoked.
          currency: price?.currency ?? 'XXX',
          endsAccess: true,
        },
      ];
    }
    // Cancelled in the store (access runs to the end of the paid period) or expired: the subscription stops
    // renewing and ends with the period Keres already holds.
    case NOTIFICATION.CANCELED:
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
