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

async function ensurePlan(
  cfg: PayPalConfig,
  token: TokenGetter,
  plans: Map<string, string>,
  request: CheckoutRequestWire,
  fetchImpl: typeof fetch,
): Promise<string> {
  const key = `${request.tier.id}:${request.interval}:${request.currency}`;
  const known = plans.get(key);
  if (known) return known;
  const access = await token(cfg);
  const product = await paypalFetch(cfg, access, '/v1/catalogs/products', fetchImpl, {
    method: 'POST',
    body: JSON.stringify({ name: request.tier.name, type: 'SERVICE' }),
  });
  const productId = (product.body as { id?: string }).id;
  if (product.status >= 300 || !productId) throw new Error('PayPal refused the product.');
  const plan = await paypalFetch(cfg, access, '/v1/billing/plans', fetchImpl, {
    method: 'POST',
    body: JSON.stringify({
      product_id: productId,
      name: `${request.tier.name} (${request.interval})`,
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
  plans.set(key, planId);
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
  const plans = new Map<string, string>();
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
      const currency = last?.amount_with_breakdown?.gross_amount?.currency_code ?? 'USD';
      if (!last?.id) {
        return succeededEvent(
          `paypal-sub-${providerReference}`,
          { checkoutId, subscriptionReference: providerReference },
          0,
          currency,
          now,
        );
      }
      return succeededEvent(
        last.id,
        { checkoutId, subscriptionReference: providerReference },
        parseMoney(last.amount_with_breakdown?.gross_amount?.value, currency),
        currency,
        last.time ?? now,
      );
    },

    async cancelSubscription(subscriptionReference, context) {
      const cfg = paypalConfig(context.config);
      if (!cfg) throw new Error('PayPal is not configured.');
      const access = await tokens(context.fetchImpl)(cfg);
      await paypalFetch(
        cfg,
        access,
        `/v1/billing/subscriptions/${encodeURIComponent(subscriptionReference)}/cancel`,
        context.fetchImpl,
        { method: 'POST', body: JSON.stringify({ reason: 'Canceled by the subscriber.' }) },
      );
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
        case 'PAYMENT.CAPTURE.COMPLETED': {
          const amount = resource.amount as { value?: string; currency_code?: string } | undefined;
          const currency = amount?.currency_code ?? 'USD';
          return [
            succeededEvent(
              str(resource.id),
              { checkoutId: str(resource.custom_id) || undefined },
              parseMoney(amount?.value, currency),
              currency,
              str(resource.create_time) || new Date().toISOString(),
            ),
          ];
        }
        case 'BILLING.SUBSCRIPTION.ACTIVATED': {
          const amount = resource.billing_info as
            | { last_payment?: { amount?: { value?: string; currency_code?: string } } }
            | undefined;
          const currency = amount?.last_payment?.amount?.currency_code ?? 'USD';
          return [
            succeededEvent(
              `paypal-sub-${str(resource.id)}`,
              {
                checkoutId: str(resource.custom_id) || undefined,
                subscriptionReference: str(resource.id),
              },
              parseMoney(amount?.last_payment?.amount?.value, currency),
              currency,
              new Date().toISOString(),
            ),
          ];
        }
        case 'PAYMENT.SALE.COMPLETED': {
          const amount = resource.amount as { total?: string; currency?: string } | undefined;
          const currency = amount?.currency ?? 'USD';
          return [
            succeededEvent(
              str(resource.id),
              { subscriptionReference: str(resource.billing_agreement_id) || str(resource.id) },
              parseMoney(amount?.total, currency),
              currency,
              new Date().toISOString(),
            ),
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
