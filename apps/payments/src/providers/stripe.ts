import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentsConfig } from '../config';
import type { CheckoutRequestWire, PaymentEventWire, PaymentMethodOption } from '../wire';
import type { Provider, ProviderContext } from './types';

/**
 * Google Pay on the web, through Stripe Checkout: a Checkout Session with card payments shows
 * Google Pay (and Apple Pay) by itself where the browser supports it, so there is no Google-side
 * redirect to build - the `redirect` below is Stripe's hosted page. This is the documented,
 * supported way to take Google Pay on the web without a custom gateway integration.
 *
 * Recurring works the same way: Checkout Sessions in `subscription` mode create the Stripe
 * subscription, which charges every period and reports through the webhook.
 */

const STRIPE_BASE = 'https://api.stripe.com';
const SUPPORTED_CURRENCIES = new Set([
  'USD',
  'EUR',
  'BRL',
  'GBP',
  'CAD',
  'AUD',
  'JPY',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'MXN',
  'ARS',
  'CLP',
  'COP',
  'PEN',
]);

interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
}

export function stripeConfig(config: PaymentsConfig): StripeConfig | null {
  return config.stripe;
}

type StripeForm = Record<string, string>;

async function stripeCall(
  cfg: StripeConfig,
  method: string,
  path: string,
  fetchImpl: typeof fetch,
  form?: StripeForm,
): Promise<{ status: number; body: unknown }> {
  const body = form ? new URLSearchParams(form).toString() : undefined;
  const response = await fetchImpl(`${STRIPE_BASE}${path}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${cfg.secretKey}:`).toString('base64')}`,
      ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  });
  return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
}

interface StripeSession {
  id?: string;
  url?: string;
  status?: string;
  payment_status?: string;
  amount_total?: number;
  currency?: string;
  subscription?: string;
  /** The first invoice of a subscription session: the same payment the invoice webhook reports. */
  invoice?: string | null;
  metadata?: Record<string, string>;
  client_reference_id?: string;
}

/**
 * The event id of the payment a Checkout Session made. A subscription's first payment reaches us
 * twice - as the session completing and as its first invoice being paid - and both must be one
 * event, or the first period would be granted twice. The invoice id is what they share.
 */
function sessionEventId(session: StripeSession): string {
  return session.invoice ? `stripe-invoice-${session.invoice}` : `stripe-session-${session.id}`;
}

/** Verifies a Stripe webhook signature (`t=...,v1=...`) over the raw bytes. */
export function verifyStripeSignature(
  webhookSecret: string,
  rawBody: string,
  header: string | null,
  now = Date.now(),
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((chunk) => {
      const index = chunk.indexOf('=');
      return index === -1 ? [chunk, ''] : [chunk.slice(0, index), chunk.slice(index + 1)];
    }),
  );
  const timestamp = Number(parts.t ?? '');
  const signature = parts.v1 ?? '';
  if (!Number.isFinite(timestamp) || !signature) return false;
  if (Math.abs(Math.floor(now / 1000) - timestamp) > 300) return false;
  const expected = Buffer.from(
    createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex'),
  );
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function succeeded(
  eventId: string,
  checkoutId: string | undefined,
  subscriptionReference: string | undefined,
  amountCents: number,
  currency: string,
): PaymentEventWire {
  return {
    type: 'payment.succeeded',
    eventId,
    ...(checkoutId ? { checkoutId } : {}),
    ...(subscriptionReference ? { subscriptionReference } : {}),
    paidAt: new Date().toISOString(),
    amountCents,
    currency: currency.toUpperCase(),
  };
}

export function createStripeProvider(): Provider {
  return {
    methodIds: ['googlepay'],
    hasStatus: true,
    hasCancel: true,

    // Stripe subscription ids are `sub_...`.
    ownsSubscription: (subscriptionReference) => subscriptionReference.startsWith('sub_'),
    // A Stripe checkout's reference is its Checkout Session id.
    ownsCheckoutReference: (providerReference) => providerReference.startsWith('cs_'),

    methods(currency: string): PaymentMethodOption[] {
      if (!SUPPORTED_CURRENCIES.has(currency)) return [];
      return [
        {
          id: 'googlepay',
          label: 'Google Pay',
          description: 'Pay with Google Pay through a secure checkout page.',
          recurring: true,
          flow: 'redirect',
        },
      ];
    },

    async createCheckout(request: CheckoutRequestWire, context: ProviderContext) {
      const cfg = stripeConfig(context.config);
      if (!cfg) throw new Error('Google Pay is not configured.');
      const recurring = request.interval === 'monthly' || request.interval === 'yearly';
      const form: StripeForm = {
        mode: recurring ? 'subscription' : 'payment',
        'payment_method_types[0]': 'card',
        'line_items[0][price_data][currency]': request.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': String(request.amountCents),
        'line_items[0][price_data][product_data][name]': request.tier.name,
        'line_items[0][quantity]': '1',
        success_url: `${context.config.publicBaseUrl}/v1/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${context.config.publicBaseUrl}/v1/stripe/return?cancelled=1`,
        client_reference_id: request.checkoutId,
        'metadata[checkoutId]': request.checkoutId,
      };
      if (recurring) {
        form['line_items[0][price_data][recurring][interval]'] =
          request.interval === 'yearly' ? 'year' : 'month';
      }
      const created = await stripeCall(
        cfg,
        'POST',
        '/v1/checkout/sessions',
        context.fetchImpl,
        form,
      );
      const session = created.body as StripeSession;
      if (created.status >= 300 || !session.id || !session.url) {
        throw new Error('The checkout provider refused the session.');
      }
      context.store.remember(request.checkoutId, {
        methodId: 'googlepay',
        providerReference: session.id,
      });
      return { providerReference: session.id, action: { kind: 'redirect', url: session.url } };
    },

    async getStatus(checkoutId, providerReference, context) {
      const cfg = stripeConfig(context.config);
      if (!cfg) throw new Error('Google Pay is not configured.');
      const fetched = await stripeCall(
        cfg,
        'GET',
        `/v1/checkout/sessions/${encodeURIComponent(providerReference)}`,
        context.fetchImpl,
      );
      if (fetched.status === 404) return null;
      const session = fetched.body as StripeSession;
      // The attempt travels with the session (metadata); what was asked about is only a fallback.
      const attempt = session.metadata?.checkoutId || session.client_reference_id || checkoutId;
      if (session.status === 'complete') {
        return succeeded(
          sessionEventId(session),
          attempt,
          session.subscription,
          session.amount_total ?? 0,
          session.currency ?? 'USD',
        );
      }
      if (session.status === 'expired') {
        return {
          type: 'payment.failed',
          eventId: `stripe-expired-${session.id}`,
          checkoutId: attempt,
          reason: 'expired',
        };
      }
      return null;
    },

    async cancelSubscription(subscriptionReference, context) {
      const cfg = stripeConfig(context.config);
      if (!cfg) throw new Error('Google Pay is not configured.');
      const result = await stripeCall(
        cfg,
        'DELETE',
        `/v1/subscriptions/${encodeURIComponent(subscriptionReference)}`,
        context.fetchImpl,
      );
      if (result.status >= 300) {
        throw new Error(`Stripe did not cancel the subscription (${result.status}).`);
      }
    },

    async handleWebhook(request: Request, context: ProviderContext): Promise<PaymentEventWire[]> {
      const cfg = stripeConfig(context.config);
      if (!cfg) throw new Error('Google Pay is not configured.');
      const raw = await request.text();
      if (!verifyStripeSignature(cfg.webhookSecret, raw, request.headers.get('stripe-signature'))) {
        throw new Error('Stripe webhook signature rejected.');
      }
      const event = JSON.parse(raw) as {
        type?: string;
        id?: string;
        data?: { object?: Record<string, unknown> };
      };
      const object = event.data?.object ?? {};
      const str = (value: unknown): string => (typeof value === 'string' ? value : '');
      const num = (value: unknown): number =>
        typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = object as StripeSession & { currency?: string };
          if (session.payment_status !== 'paid' && !session.subscription) return [];
          return [
            succeeded(
              sessionEventId(session),
              str(session.metadata?.checkoutId) || str(session.client_reference_id) || undefined,
              session.subscription ? str(session.subscription) : undefined,
              num(session.amount_total),
              str(session.currency) || 'USD',
            ),
          ];
        }
        case 'invoice.payment_succeeded': {
          const invoice = object as {
            subscription?: string;
            parent?: { subscription_details?: { subscription?: string } };
            billing_reason?: string;
            amount_paid?: number;
            currency?: string;
          };
          // The first invoice of a subscription is the payment the completed session already
          // reports (same event id, and the session carries our attempt id this one lacks).
          if (invoice.billing_reason === 'subscription_create') return [];
          // Newer API versions moved the subscription from the invoice itself under `parent`.
          const subscription =
            str(invoice.subscription) || str(invoice.parent?.subscription_details?.subscription);
          if (!subscription) return [];
          return [
            succeeded(
              `stripe-invoice-${str((object as { id?: string }).id)}`,
              undefined,
              subscription,
              num(invoice.amount_paid),
              str(invoice.currency) || 'USD',
            ),
          ];
        }
        case 'customer.subscription.deleted': {
          const subscription = str((object as { id?: string }).id);
          if (!subscription) return [];
          return [
            {
              type: 'subscription.canceled',
              eventId: `stripe-cancel-${subscription}`,
              subscriptionReference: subscription,
            },
          ];
        }
        default:
          return [];
      }
    },
  };
}
