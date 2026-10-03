import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  type CheckoutRequest,
  type CheckoutResult,
  type DueSubscription,
  type PaymentEvent,
  type PaymentMethodOption,
  type PaymentPlugin,
  PaymentWebhookRejectedError,
  type WebhookRequest,
} from '@keres/shared/payments/PaymentPlugin';
import type { DemoEvent, DemoProvider } from './DemoProvider';

/**
 * The demo provider's plugin, and the reference for writing a real one: it is what sits between Keres and a
 * provider, and does three things - asks the provider for a payment, checks that a notice really came from it,
 * and translates its vocabulary (`charge.paid`) into Keres' (`payment.succeeded`). The provider here lives in
 * memory (`DemoProvider`); a real plugin would make HTTP calls to the provider's API at the same three places.
 *
 * It keeps nothing of its own: no card, no state. What the provider needs to remember (the saved card, the
 * subscription) the provider remembers.
 */
export const DEMO_PAY_ID = 'demopay';
export const DEMO_SIGNATURE_HEADER = 'x-demopay-signature';

const METHODS: PaymentMethodOption[] = [
  { id: 'card', label: 'Test card', description: 'Simulated: no card data is asked or kept' },
  {
    id: 'pix',
    label: 'PIX',
    description: 'A made-up code, confirmed on the demo page',
    // Paid again each period: nothing here charges it by itself.
    recurring: false,
  },
  {
    id: 'boleto',
    label: 'Boleto',
    description: 'A made-up line, confirmed on the demo page',
    recurring: false,
  },
];

/** `sha256=<hex>` over the body exactly as sent: how a provider proves a notice is its own. */
export function signDemoNotice(rawBody: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

function signatureMatches(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(signDemoNotice(rawBody, secret));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** The provider's notice in Keres' terms; null for one that does not concern Keres. */
export function toKeresEvent(event: DemoEvent): PaymentEvent | null {
  switch (event.type) {
    case 'charge.paid':
      return {
        type: 'payment.succeeded',
        eventId: event.id,
        // The attempt, for a first payment; a renewal has none and is matched by the subscription.
        ...(event.data.reference ? { checkoutId: event.data.reference } : {}),
        subscriptionReference: event.data.subscriptionId,
        paidAt: new Date(event.data.paidAt),
        amountCents: event.data.amountCents,
        currency: event.data.currency,
      };
    case 'charge.failed':
      return {
        type: 'payment.failed',
        eventId: event.id,
        ...(event.data.reference ? { checkoutId: event.data.reference } : {}),
        ...(event.data.subscriptionId ? { subscriptionReference: event.data.subscriptionId } : {}),
        reason: event.data.reason,
      };
    case 'charge.expired':
      return { type: 'checkout.expired', eventId: event.id, checkoutId: event.data.reference };
    case 'subscription.canceled':
      return {
        type: 'subscription.canceled',
        eventId: event.id,
        subscriptionReference: event.data.subscriptionId,
      };
    default:
      return null;
  }
}

export interface DemoPayPluginOptions {
  provider: DemoProvider;
  /** Signs the notices: the provider and the plugin share it, as they would share a webhook secret. */
  secret: string;
  /** Where the provider's hosted page is reached from the person's device. */
  baseUrl: string;
}

export function createDemoPayPlugin({
  provider,
  secret,
  baseUrl,
}: DemoPayPluginOptions): PaymentPlugin {
  const pageOf = (chargeId: string) => `${baseUrl.replace(/\/+$/, '')}/buy?charge=${chargeId}`;

  return {
    id: DEMO_PAY_ID,
    displayName: 'Demo Pay',

    listMethods: () => METHODS,

    async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
      const charge = provider.createCharge({
        reference: request.checkoutId,
        userId: request.payer.userId,
        username: request.payer.username,
        tierId: request.tier.id,
        tierName: request.tier.name,
        interval: request.interval,
        amountCents: request.amountCents,
        currency: request.currency,
        methodId: request.methodId,
      });
      const page = pageOf(charge.id);
      if (charge.code) {
        // PIX and boleto have no page to go to: the person is told what to pay, and how (here, on the demo page).
        return {
          providerReference: charge.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          action: {
            kind: 'instructions',
            title: charge.methodId === 'pix' ? 'Pay with PIX (demo)' : 'Pay the boleto (demo)',
            text: `Nothing here is real. Open ${page} and press "confirm that this was paid".`,
            copyText: charge.code,
          },
        };
      }
      return {
        providerReference: charge.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        action: { kind: 'redirect', url: page },
      };
    },

    async handleWebhook({ headers, rawBody }: WebhookRequest): Promise<PaymentEvent[]> {
      if (!signatureMatches(rawBody, headers[DEMO_SIGNATURE_HEADER], secret)) {
        throw new PaymentWebhookRejectedError('bad signature');
      }
      let parsed: DemoEvent;
      try {
        parsed = JSON.parse(rawBody) as DemoEvent;
      } catch {
        throw new PaymentWebhookRejectedError('not JSON');
      }
      const event = toKeresEvent(parsed);
      return event ? [event] : [];
    },

    /** For when a webhook did not arrive: ask the provider how the payment ended. Null while it is open. */
    async getCheckoutStatus(_checkoutId, providerReference): Promise<PaymentEvent | null> {
      const charge = provider.findCharge(providerReference);
      if (!charge) return null;
      if (charge.status === 'paid' && charge.subscriptionId && charge.paidAt) {
        // The same event id the webhook uses for this payment, so hearing it twice counts once.
        return toKeresEvent({
          id: `${charge.id}:paid`,
          type: 'charge.paid',
          data: {
            chargeId: charge.id,
            reference: charge.reference,
            subscriptionId: charge.subscriptionId,
            amountCents: charge.amountCents,
            currency: charge.currency,
            paidAt: charge.paidAt,
          },
        });
      }
      if (charge.status === 'failed') {
        return toKeresEvent({
          id: `${charge.id}:failed`,
          type: 'charge.failed',
          data: {
            chargeId: charge.id,
            reference: charge.reference,
            subscriptionId: charge.subscriptionId,
            reason: charge.failureReason ?? 'Payment failed',
          },
        });
      }
      return null;
    },

    /** Keres asks for the subscription to stop being charged: it is canceled at the provider. */
    async cancelSubscription(subscriptionReference: string): Promise<void> {
      provider.cancel(subscriptionReference);
    },

    /** A period passed unpaid: the provider puts a renewal in front of the person (and, for a card, waits to be told to charge it). */
    async onSubscriptionDue(subscription: DueSubscription): Promise<void> {
      if (subscription.subscriptionReference) provider.chase(subscription.subscriptionReference);
    },
  };
}
