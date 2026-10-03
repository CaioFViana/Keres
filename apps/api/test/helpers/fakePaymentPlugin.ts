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
import { vi } from 'vitest';

/**
 * A payment plugin for the tests, and only for them: it speaks to no provider. It is also the reference for
 * what a real one looks like - the same interface, a webhook whose "signature" is a header, and checkouts
 * that stay where the test put them.
 *
 * The body of its webhooks is `{ "events": [...] }` with the events as the plugin contract defines them
 * (dates as ISO strings, which `handleWebhook` turns back into `Date`s).
 */
export const FAKE_PLUGIN_ID = 'fakepay';
export const FAKE_SIGNATURE_HEADER = 'x-fake-signature';
export const FAKE_VALID_SIGNATURE = 'valid';

export interface FakePluginOptions {
  /** What `createCheckout` answers; the default is a hosted checkout. */
  action?: (request: CheckoutRequest) => CheckoutResult['action'];
  methods?: PaymentMethodOption[];
  withStatusPolling?: boolean;
  withCancel?: boolean;
  withDueHook?: boolean;
}

export function createFakePaymentPlugin(options: FakePluginOptions = {}) {
  const requests: CheckoutRequest[] = [];
  const state = {
    status: null as PaymentEvent | null,
    createFails: false,
    cancelFails: false,
  };

  const plugin: PaymentPlugin = {
    id: FAKE_PLUGIN_ID,
    displayName: 'Fake Pay',
    listMethods: () =>
      options.methods ?? [
        { id: 'card', label: 'Card' },
        { id: 'pix', label: 'PIX', description: 'Instant transfer' },
      ],
    createCheckout: async (request) => {
      if (state.createFails) throw new Error('the provider is down');
      requests.push(request);
      return {
        providerReference: `fake_checkout_${request.checkoutId}`,
        action: options.action?.(request) ?? {
          kind: 'redirect',
          url: `https://pay.example.test/checkout/${request.checkoutId}`,
        },
      };
    },
    handleWebhook: async (request: WebhookRequest) => {
      if (request.headers[FAKE_SIGNATURE_HEADER] !== FAKE_VALID_SIGNATURE) {
        throw new PaymentWebhookRejectedError('bad signature');
      }
      let parsed: { events?: Record<string, unknown>[] };
      try {
        parsed = JSON.parse(request.rawBody);
      } catch {
        throw new PaymentWebhookRejectedError('not JSON');
      }
      return (parsed.events ?? []).map((event) => ({
        ...event,
        ...(typeof event.paidAt === 'string' ? { paidAt: new Date(event.paidAt) } : {}),
      })) as PaymentEvent[];
    },
  };

  const cancelSubscription = vi.fn(async (_reference: string) => {
    if (state.cancelFails) throw new Error('the provider refused');
  });
  const onSubscriptionDue = vi.fn(async (_subscription: DueSubscription) => undefined);
  const getCheckoutStatus = vi.fn(async (_id: string, _reference: string) => state.status);
  if (options.withCancel) plugin.cancelSubscription = cancelSubscription;
  if (options.withDueHook) plugin.onSubscriptionDue = onSubscriptionDue;
  if (options.withStatusPolling) plugin.getCheckoutStatus = getCheckoutStatus;

  return { plugin, requests, state, cancelSubscription, onSubscriptionDue, getCheckoutStatus };
}

/** The body of a webhook carrying these events. */
export function webhookBody(events: Record<string, unknown>[]): string {
  return JSON.stringify({ events });
}
