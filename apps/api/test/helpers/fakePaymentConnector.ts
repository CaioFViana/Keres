import type {
  CheckoutRequest,
  CheckoutResult,
  DueSubscription,
  PaymentConnector,
  PaymentEvent,
  PaymentMethodOption,
  PlayVerifyRequest,
  PlayVerifyResponse,
} from '@keres/shared/payments/PaymentConnector';
import { vi } from 'vitest';

/**
 * A payment connector for the tests, and only for them: it speaks to no provider and to no network. It stands in for
 * the connector as the rest of the server sees it (`PaymentConnector`), with the optional parts each test asks for.
 * The events a real connector would send are delivered by `postEvents` (`helpers/paymentEvents.ts`), signed as the
 * contract says.
 */
export const FAKE_CONNECTOR_ID = 'fakepay';

export interface FakeConnectorOptions {
  /** What `createCheckout` answers; the default is a hosted checkout. */
  action?: (request: CheckoutRequest) => CheckoutResult['action'];
  methods?: PaymentMethodOption[];
  withStatusPolling?: boolean;
  withCancel?: boolean;
  withDueHook?: boolean;
  /** Answers `verifyPlayPurchase` like the service would (including reporting the event). */
  verifyPlay?: (request: PlayVerifyRequest) => Promise<PlayVerifyResponse> | PlayVerifyResponse;
}

export function createFakePaymentConnector(options: FakeConnectorOptions = {}) {
  const requests: CheckoutRequest[] = [];
  const state = {
    status: null as PaymentEvent | null,
    createFails: false,
    cancelFails: false,
  };

  const connector: PaymentConnector = {
    id: FAKE_CONNECTOR_ID,
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
  };

  const cancelSubscription = vi.fn(async (_reference: string) => {
    if (state.cancelFails) throw new Error('the provider refused');
  });
  const onSubscriptionDue = vi.fn(async (_subscription: DueSubscription) => undefined);
  const getCheckoutStatus = vi.fn(async (_id: string, _reference: string) => state.status);
  if (options.withCancel) connector.cancelSubscription = cancelSubscription;
  if (options.withDueHook) connector.onSubscriptionDue = onSubscriptionDue;
  if (options.withStatusPolling) connector.getCheckoutStatus = getCheckoutStatus;
  const verifyPlayPurchase = vi.fn(
    async (request: PlayVerifyRequest) => options.verifyPlay?.(request) ?? { active: false },
  );
  if (options.verifyPlay) connector.verifyPlayPurchase = verifyPlayPurchase;

  return {
    connector,
    requests,
    state,
    cancelSubscription,
    onSubscriptionDue,
    getCheckoutStatus,
    verifyPlayPurchase,
  };
}
