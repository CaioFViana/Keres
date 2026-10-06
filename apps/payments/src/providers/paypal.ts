import type { PaymentsConfig } from '../config';
import type { CheckoutRequestWire, PaymentEventWire, PaymentMethodOption } from '../wire';
import type { Provider, ProviderContext } from './types';

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const LIVE_BASE = 'https://api-m.paypal.com';

/** Currencies PayPal takes with two decimals everywhere else; these have none. */
const ZERO_DECIMAL = new Set(['JPY']);

/** A short list of what this service sells through PayPal; anything else is not offered. */
const SUPPORTED_CURRENCIES = new Set(['USD', 'EUR', 'BRL', 'GBP', 'CAD', 'AUD', 'JPY']);

function money(amountCents: number, currency: string): string {
  if (ZERO_DECIMAL.has(currency)) return String(Math.round(amountCents / 100));
  return (amountCents / 100).toFixed(2);
}

function parseMoney(value: string | undefined, currency: string): number {
  const parsed = Number(value ?? '0');
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  // Zero-decimal values already are minor units; the rest arrive with decimals.
  return ZERO_DECIMAL.has(currency) ? Math.round(parsed) : Math.round(parsed * 100);
}

interface PayPalConfig {
  clientId: string;
  secret: string;
  sandbox: boolean;
  webhookId: string;
}

export function paypalConfig(config: PaymentsConfig): PayPalConfig | null {
  return config.paypal;
}

export function paypalBase(sandbox: boolean): string {
  return sandbox ? SANDBOX_BASE : LIVE_BASE;
}

async function paypalFetch(
  cfg: PayPalConfig,
  token: string,
  path: string,
  fetchImpl: typeof fetch,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const response = await fetchImpl(`${paypalBase(cfg.sandbox)}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const body = (await response.json().catch(() => null)) as unknown;
  return { status: response.status, body };
}

/** Client-credentials token, cached to a minute before it lapses. */
export function createTokenCache(fetchImpl: typeof fetch) {
  let cached: { token: string; expiresAt: number } | null = null;
  return async (cfg: PayPalConfig): Promise<string> => {
    if (cached && Date.now() < cached.expiresAt) return cached.token;
    const response = await fetchImpl(`${paypalBase(cfg.sandbox)}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!response.ok) throw new Error(`PayPal refused the credentials (${response.status}).`);
    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('PayPal answered without an access token.');
    cached = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
    };
    return cached.token;
  };
}

type TokenGetter = (cfg: PayPalConfig) => Promise<string>;

function approveLink(body: unknown): string | null {
  const links = (body as { links?: Array<{ rel?: string; href?: string }> }).links;
  return (
    links?.find((link) => link.rel === 'approve' && link.href?.startsWith('https://'))?.href ?? null
  );
}

/**
 * The PayPal billing plan selling a tier for a period, created once and reused. The price is part of
 * the key (a plan's price cannot be edited, so a tier whose price changed needs a new plan), and the
 * pending creation is what is cached, so two checkouts at the same moment share one plan.
 */
function ensurePlan(
  cfg: PayPalConfig,
  token: TokenGetter,
  plans: Map<string, Promise<string>>,
  request: CheckoutRequestWire,
  fetchImpl: typeof fetch,
): Promise<string> {
  const key = `${request.tier.id}:${request.interval}:${request.currency}:${request.amountCents}`;
  const known = plans.get(key);
  if (known) return known;
  const created = createPlan(cfg, token, request, fetchImpl);
  plans.set(key, created);
  created.catch(() => plans.delete(key));
  return created;
}

async function createPlan(
  cfg: PayPalConfig,
  token: TokenGetter,
  request: CheckoutRequestWire,
  fetchImpl: typeof fetch,
): Promise<string> {
  const access = await token(cfg);
  const product = await paypalFetch(cfg, access, '/v1/catalogs/products', fetchImpl, {
    method: 'POST',
    headers: { 'paypal-request-id': `keres-product-${request.tier.id}` },
    body: JSON.stringify({ name: request.tier.name, type: 'SERVICE' }),
  });
  const productId = (product.body as { id?: string }).id;
  if (product.status >= 300 || !productId) throw new Error('PayPal refused the product.');
  const plan = await paypalFetch(cfg, access, '/v1/billing/plans', fetchImpl, {
    method: 'POST',
    headers: {
      'paypal-request-id': `keres-plan-${request.tier.id}-${request.interval}-${request.currency}-${request.amountCents}`,
    },
    body: JSON.stringify({
      product_id: productId,
      name: `${request.tier.name} (${request.interval}, ${money(request.amountCents, request.currency)} ${request.currency})`,
      billing_cycles: [
        {
          frequency: {
            interval_unit: request.interval === 'yearly' ? 'YEAR' : 'MONTH',
            interval_count: 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: money(request.amountCents, request.currency),
              currency_code: request.currency,
            },
          },
        },
      ],
      payment_preferences: { auto_bill_outstanding: true },
    }),
  });
  const planId = (plan.body as { id?: string }).id;
  if (plan.status >= 300 || !planId) throw new Error('PayPal refused the plan.');
  return planId;
}

function succeededEvent(
  eventId: string,
  request: { checkoutId?: string; subscriptionReference?: string },
  amountCents: number,
  currency: string,
  paidAt: string,
): PaymentEventWire {
  return {
    type: 'payment.succeeded',
    eventId,
    ...(request.checkoutId ? { checkoutId: request.checkoutId } : {}),
    ...(request.subscriptionReference
      ? { subscriptionReference: request.subscriptionReference }
      : {}),
    paidAt,
    amountCents,
    currency,
  };
}

export function createPayPalProvider(): Provider {
  const plans = new Map<string, Promise<string>>();
  const tokenCaches = new WeakMap<typeof fetch, TokenGetter>();
  const tokens = (fetchImpl: typeof fetch): TokenGetter => {
    let getter = tokenCaches.get(fetchImpl);
    if (!getter) {
      getter = createTokenCache(fetchImpl);
      tokenCaches.set(fetchImpl, getter);
    }
    return getter;
  };

  return {
    methodIds: ['paypal'],
    hasStatus: true,
    hasCancel: true,
    hasReconcile: true,

    // PayPal subscription ids are `I-...`.
    ownsSubscription: (subscriptionReference) => subscriptionReference.startsWith('I-'),
    // A PayPal checkout's reference is its subscription id.
    ownsCheckoutReference: (providerReference) => providerReference.startsWith('I-'),

    methods(currency: string): PaymentMethodOption[] {
      if (!SUPPORTED_CURRENCIES.has(currency)) return [];
      return [{ id: 'paypal', label: 'PayPal', recurring: true, flow: 'redirect' }];
    },

    async createCheckout(request: CheckoutRequestWire, context: ProviderContext) {
      const cfg = paypalConfig(context.config);
      if (!cfg) throw new Error('PayPal is not configured.');
      const access = await tokens(context.fetchImpl)(cfg);
      const base = context.config.publicBaseUrl;
      // Plans are recurring by nature (monthly/yearly), so PayPal always sells a subscription -
      // there is no one-time order branch.
      const planId = await ensurePlan(
        cfg,
        tokens(context.fetchImpl),
        plans,
        request,
        context.fetchImpl,
      );
      const sub = await paypalFetch(cfg, access, '/v1/billing/subscriptions', context.fetchImpl, {
        method: 'POST',
        body: JSON.stringify({
          plan_id: planId,
          custom_id: request.checkoutId,
          application_context: {
            brand_name: 'Keres',
            return_url: `${base}/v1/paypal/return`,
            cancel_url: `${base}/v1/paypal/return?cancelled=1`,
          },
        }),
      });
      const id = (sub.body as { id?: string }).id;
      const url = approveLink(sub.body);
      if (sub.status >= 300 || !id || !url) throw new Error('PayPal refused the subscription.');
      context.store.remember(request.checkoutId, {
        methodId: 'paypal',
        providerReference: id,
        subscriptionReference: id,
      });
      return { providerReference: id, action: { kind: 'redirect', url } };
    },

    async getStatus(checkoutId, providerReference, context) {
      const cfg = paypalConfig(context.config);
      if (!cfg) throw new Error('PayPal is not configured.');
      const access = await tokens(context.fetchImpl)(cfg);
      const sub = await paypalFetch(
        cfg,
        access,
        `/v1/billing/subscriptions/${encodeURIComponent(providerReference)}`,
        context.fetchImpl,
      );
      const status = (sub.body as { status?: string }).status;
      // The attempt this subscription was made for travels with it; what was asked about is only a fallback.
      const attempt = (sub.body as { custom_id?: string }).custom_id || checkoutId;
      if (status === 'CANCELLED' || status === 'EXPIRED') {
        return {
          type: 'subscription.canceled',
          eventId: `paypal-cancel-${providerReference}`,
          subscriptionReference: providerReference,
        };
      }
      if (status !== 'ACTIVE') return null;
      const since = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();
      const now = new Date().toISOString();
      const txns = await paypalFetch(
        cfg,
        access,
        `/v1/billing/subscriptions/${encodeURIComponent(providerReference)}/transactions?start_time=${encodeURIComponent(since)}&end_time=${encodeURIComponent(now)}`,
        context.fetchImpl,
      );
      const last = (
        txns.body as {
          transactions?: Array<{
            id?: string;
            amount_with_breakdown?: { gross_amount?: { value?: string; currency_code?: string } };
            time?: string;
          }>;
        }
      ).transactions?.[0];
      // Approved but not charged yet: nothing was paid, so nothing is reported. The charge arrives
      // as a sale (webhook) or shows up in the transactions on the next look. An event with no
      // payment behind it would grant a period for free, and a second one for the real charge.
      if (!last?.id) return null;
      const currency = last.amount_with_breakdown?.gross_amount?.currency_code ?? 'USD';
      return succeededEvent(
        last.id,
        { checkoutId: attempt, subscriptionReference: providerReference },
        parseMoney(last.amount_with_breakdown?.gross_amount?.value, currency),
        currency,
        last.time ?? now,
      );
    },

    async listSubscriptionEvents(subscriptionReference, since, context) {
      const cfg = paypalConfig(context.config);
      if (!cfg) throw new Error('PayPal is not configured.');
      const access = await tokens(context.fetchImpl)(cfg);
      const reference = encodeURIComponent(subscriptionReference);
      const sub = await paypalFetch(
        cfg,
        access,
        `/v1/billing/subscriptions/${reference}`,
        context.fetchImpl,
      );
      if (sub.status >= 300)
        throw new Error(`PayPal could not read the subscription (${sub.status}).`);
      const body = sub.body as { status?: string; custom_id?: string };
      const txns = await paypalFetch(
        cfg,
        access,
        `/v1/billing/subscriptions/${reference}/transactions?start_time=${encodeURIComponent(since.toISOString())}&end_time=${encodeURIComponent(new Date().toISOString())}`,
        context.fetchImpl,
      );
      if (txns.status >= 300)
        throw new Error(`PayPal could not list the payments (${txns.status}).`);
      const events: PaymentEventWire[] = [];
      for (const transaction of (
        txns.body as {
          transactions?: Array<{
            id?: string;
            status?: string;
            amount_with_breakdown?: { gross_amount?: { value?: string; currency_code?: string } };
            time?: string;
          }>;
        }
      ).transactions ?? []) {
        // Only a charge that went through: the id is the sale's, the same one its webhook carries.
        if (!transaction.id || (transaction.status && transaction.status !== 'COMPLETED')) continue;
        const gross = transaction.amount_with_breakdown?.gross_amount;
        const currency = gross?.currency_code ?? 'USD';
        events.push(
          succeededEvent(
            transaction.id,
            { checkoutId: body.custom_id || undefined, subscriptionReference },
            parseMoney(gross?.value, currency),
            currency,
            transaction.time ?? new Date().toISOString(),
          ),
        );
      }
      events.sort((a, b) =>
        String('paidAt' in a ? a.paidAt : '').localeCompare(String('paidAt' in b ? b.paidAt : '')),
      );
      if (body.status === 'CANCELLED' || body.status === 'EXPIRED') {
        events.push({
          type: 'subscription.canceled',
          eventId: `paypal-cancel-${subscriptionReference}`,
          subscriptionReference,
        });
      }
      return events;
    },

    async cancelSubscription(subscriptionReference, context) {
      const cfg = paypalConfig(context.config);
      if (!cfg) throw new Error('PayPal is not configured.');
      const access = await tokens(context.fetchImpl)(cfg);
      const result = await paypalFetch(
        cfg,
        access,
        `/v1/billing/subscriptions/${encodeURIComponent(subscriptionReference)}/cancel`,
        context.fetchImpl,
        { method: 'POST', body: JSON.stringify({ reason: 'Canceled by the subscriber.' }) },
      );
      // A subscription PayPal already considers over cannot be cancelled again; that is the goal reached.
      const alreadyOver =
        result.status === 422 &&
        (result.body as { name?: string } | null)?.name === 'SUBSCRIPTION_STATUS_INVALID';
      if (result.status >= 300 && !alreadyOver) {
        throw new Error(`PayPal did not cancel the subscription (${result.status}).`);
      }
    },

    async handleWebhook(request: Request, context: ProviderContext): Promise<PaymentEventWire[]> {
      const cfg = paypalConfig(context.config);
      if (!cfg) throw new Error('PayPal is not configured.');
      if (!cfg.webhookId) throw new Error('PayPal webhooks need PAYPAL_WEBHOOK_ID.');
      const raw = await request.text();
      const access = await tokens(context.fetchImpl)(cfg);
      const check = await paypalFetch(
        cfg,
        access,
        '/v1/notifications/verify-webhook-signature',
        context.fetchImpl,
        {
          method: 'POST',
          body: JSON.stringify({
            auth_algo: request.headers.get('paypal-auth-algo'),
            cert_url: request.headers.get('paypal-cert-url'),
            transmission_id: request.headers.get('paypal-transmission-id'),
            transmission_sig: request.headers.get('paypal-transmission-sig'),
            transmission_time: request.headers.get('paypal-transmission-time'),
            webhook_id: cfg.webhookId,
            webhook_event: JSON.parse(raw) as unknown,
          }),
        },
      );
      if ((check.body as { verification_status?: string }).verification_status !== 'SUCCESS') {
        throw new Error('PayPal webhook signature rejected.');
      }
      const event = JSON.parse(raw) as { event_type?: string; resource?: Record<string, unknown> };
      const resource = event.resource ?? {};
      const str = (value: unknown): string => (typeof value === 'string' ? value : '');
      switch (event.event_type) {
        // One charge, one event: a subscription's every charge (the first included) is a completed
        // sale, and its id is the event id - the same one the return hop reads from the transactions.
        // `BILLING.SUBSCRIPTION.ACTIVATED` and a capture notice describe the same charge under other
        // ids, so reporting them too would grant the period twice; this service sells subscriptions
        // only, so there is no one-time order to report either.
        case 'PAYMENT.SALE.COMPLETED': {
          const subscription = str(resource.billing_agreement_id);
          if (!subscription) return [];
          const amount = resource.amount as { total?: string; currency?: string } | undefined;
          const currency = amount?.currency ?? 'USD';
          // The sale does not carry our attempt id, the subscription does: it is what ties the first
          // charge to the person who started it (later charges match by the subscription itself).
          const detail = await paypalFetch(
            cfg,
            access,
            `/v1/billing/subscriptions/${encodeURIComponent(subscription)}`,
            context.fetchImpl,
          );
          if (detail.status >= 300) throw new Error('PayPal subscription could not be read.');
          const checkoutId = str((detail.body as { custom_id?: unknown } | null)?.custom_id);
          return [
            succeededEvent(
              str(resource.id),
              { checkoutId: checkoutId || undefined, subscriptionReference: subscription },
              parseMoney(amount?.total, currency),
              currency,
              str(resource.create_time) || new Date().toISOString(),
            ),
          ];
        }
        // Money that went back. The refund (or the reversed sale) names the sale; the sale names the subscription
        // it was charged to and what it cost, which is what tells a full refund from a partial one.
        case 'PAYMENT.SALE.REFUNDED':
        case 'PAYMENT.SALE.REVERSED': {
          const reversed = event.event_type === 'PAYMENT.SALE.REVERSED';
          const saleId = str(resource.sale_id) || (reversed ? str(resource.id) : '');
          if (!saleId) return [];
          const sale = await paypalFetch(
            cfg,
            access,
            `/v1/payments/sale/${encodeURIComponent(saleId)}`,
            context.fetchImpl,
          );
          if (sale.status >= 300) throw new Error('PayPal sale could not be read.');
          const saleBody = sale.body as {
            billing_agreement_id?: string;
            amount?: { total?: string; currency?: string };
            create_time?: string;
          };
          // A sale that is not a subscription's is not what Keres sold.
          const subscription = str(saleBody.billing_agreement_id);
          if (!subscription) return [];
          const currency = saleBody.amount?.currency ?? 'USD';
          const soldFor = parseMoney(saleBody.amount?.total, currency);
          const refund = resource.amount as { total?: string } | undefined;
          const refunded = reversed ? soldFor : parseMoney(refund?.total, currency);
          return [
            {
              type: 'payment.refunded',
              eventId: `paypal-refund-${str(resource.id) || saleId}`,
              subscriptionReference: subscription,
              refundedAt: str(resource.create_time) || new Date().toISOString(),
              chargedAt: str(saleBody.create_time) || new Date().toISOString(),
              amountCents: refunded,
              currency,
              endsAccess: reversed || refunded >= soldFor,
            },
          ];
        }
        case 'BILLING.SUBSCRIPTION.CANCELLED':
          return [
            {
              type: 'subscription.canceled',
              eventId: `paypal-cancel-${str(resource.id)}`,
              subscriptionReference: str(resource.id),
            },
          ];
        default:
          return [];
      }
    },
  };
}
