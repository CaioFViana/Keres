import {
  CheckoutResultWireSchema,
  CheckoutStatusResponseSchema,
  type ConnectorInfo,
  ConnectorInfoSchema,
  ConnectorMethodsResponseSchema,
} from '@keres/shared';
import type {
  CheckoutRequest,
  CheckoutResult,
  ConnectorCapability,
  DueSubscription,
  PaymentConnector,
  PaymentEvent,
  PaymentMethodOption,
} from '@keres/shared/payments/PaymentConnector';
import { z } from 'zod';
import { toPaymentEvent } from './events';
import { SignedClient, type SignedClientOptions } from './signedClient';

/** What a connector answers to a call that has nothing to give back. */
const AcknowledgedSchema = z.object({}).loose();

/** The ways to pay change when the connector is redeployed, not by the minute: asking at every page would be waste. */
const METHODS_CACHE_MS = 60_000;

export type HttpConnectorOptions = SignedClientOptions & {
  methodsCacheMs?: number;
};

/**
 * The payment connector as the server uses it: a separate service, spoken to over HTTP, in the contract of
 * `docs/payment_connectors.md`. Nothing of it is loaded into this process - what it can do is what it says in
 * `/v1/info`, and each optional call exists only when the connector said it implements it.
 *
 * Everything it returns has been signed by the connector and validated against the contract before it is used; what
 * is not is an error, and the server carries on without the payment (the person is told it could not start).
 */
export class HttpConnector implements PaymentConnector {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: readonly ConnectorCapability[];

  getCheckoutStatus?: (
    checkoutId: string,
    providerReference: string,
  ) => Promise<PaymentEvent | null>;
  cancelSubscription?: (subscriptionReference: string) => Promise<void>;
  onSubscriptionDue?: (subscription: DueSubscription) => Promise<void>;

  private readonly methods = new Map<string, { at: number; methods: PaymentMethodOption[] }>();
  private readonly now: () => number;
  private readonly methodsCacheMs: number;

  private constructor(
    info: ConnectorInfo,
    private readonly client: SignedClient,
    options: HttpConnectorOptions,
  ) {
    this.id = info.id;
    this.displayName = info.displayName;
    this.capabilities = info.capabilities;
    this.now = options.now ?? Date.now;
    this.methodsCacheMs = options.methodsCacheMs ?? METHODS_CACHE_MS;

    if (info.capabilities.includes('status')) {
      this.getCheckoutStatus = async (checkoutId, providerReference) => {
        const answer = await client.call(
          'GET',
          `/v1/checkouts/${encodeURIComponent(checkoutId)}?providerReference=${encodeURIComponent(providerReference)}`,
          undefined,
          CheckoutStatusResponseSchema,
        );
        return answer.event ? toPaymentEvent(answer.event) : null;
      };
    }
    if (info.capabilities.includes('cancel')) {
      this.cancelSubscription = async (subscriptionReference) => {
        await client.call(
          'POST',
          `/v1/subscriptions/${encodeURIComponent(subscriptionReference)}/cancel`,
          {},
          AcknowledgedSchema,
        );
      };
    }
    if (info.capabilities.includes('due')) {
      this.onSubscriptionDue = async (subscription) => {
        await client.call(
          'POST',
          '/v1/subscriptions/due',
          { ...subscription, paidUntil: subscription.paidUntil.toISOString() },
          AcknowledgedSchema,
        );
      };
    }
  }

  /** Asks the connector who it is, and holds it to the contract version this server speaks. */
  static async connect(options: HttpConnectorOptions): Promise<HttpConnector> {
    const client = new SignedClient(options);
    const info = await client.call('GET', '/v1/info', undefined, ConnectorInfoSchema);
    return new HttpConnector(info, client, options);
  }

  async listMethods(currency: string): Promise<PaymentMethodOption[]> {
    const cached = this.methods.get(currency);
    if (cached && this.now() - cached.at < this.methodsCacheMs) return cached.methods;
    try {
      const answer = await this.client.call(
        'GET',
        `/v1/methods?currency=${encodeURIComponent(currency)}`,
        undefined,
        ConnectorMethodsResponseSchema,
      );
      this.methods.set(currency, { at: this.now(), methods: answer.methods });
      return answer.methods;
    } catch (error) {
      // A connector that blinked does not take the plan screen down with it: the last list it gave still stands.
      if (cached) return cached.methods;
      throw error;
    }
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    const answer = await this.client.call(
      'POST',
      '/v1/checkouts',
      request,
      CheckoutResultWireSchema,
      // The same attempt, asked twice (a retry after a timeout), must be one payment at the provider.
      { 'idempotency-key': request.checkoutId },
    );
    return {
      providerReference: answer.providerReference,
      action: answer.action,
      ...(answer.expiresAt ? { expiresAt: new Date(answer.expiresAt) } : {}),
    };
  }
}
