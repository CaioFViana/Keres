import {
  CheckoutResultWireSchema,
  CheckoutStatusResponseSchema,
  type ConnectorInfo,
  ConnectorInfoSchema,
  ConnectorMethodsResponseSchema,
  PlayVerifyResponseSchema,
  SubscriptionEventsResponseSchema,
} from '@keres/shared';
import type {
  CheckoutRequest,
  CheckoutResult,
  ConnectorCapability,
  DueSubscription,
  PaymentConnector,
  PaymentEvent,
  PaymentMethodOption,
  PlayVerifyRequest,
  PlayVerifyResponse,
} from '@keres/shared/payments/PaymentConnector';
import { z } from 'zod';
import { toPaymentEvent } from './events';
import { ConnectorError, SignedClient, type SignedClientOptions } from './signedClient';

/** What a connector answers to a call that has nothing to give back. */
const AcknowledgedSchema = z.object({}).loose();

/** The ways to pay change when the connector is redeployed, not by the minute: asking at every page would be waste. */
const METHODS_CACHE_MS = 60_000;

export type HttpConnectorOptions = SignedClientOptions & {
  methodsCacheMs?: number;
  /** The Bearer [REDACTED] the connector asks for at `POST /v1/play/verify`; absent when store purchases are off. */
  playSecret?: string;
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
  reconcileSubscription?: (subscriptionReference: string, since: Date) => Promise<PaymentEvent[]>;
  onSubscriptionDue?: (subscription: DueSubscription) => Promise<void>;
  verifyPlayPurchase?: (request: PlayVerifyRequest) => Promise<PlayVerifyResponse>;

  private readonly methods = new Map<string, { at: number; methods: PaymentMethodOption[] }>();
  private readonly now: () => number;
  private readonly methodsCacheMs: number;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

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
    this.baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;

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
    if (info.capabilities.includes('reconcile')) {
      this.reconcileSubscription = async (subscriptionReference, since) => {
        const answer = await client.call(
          'GET',
          `/v1/subscriptions/${encodeURIComponent(subscriptionReference)}/events?since=${encodeURIComponent(since.toISOString())}`,
          undefined,
          SubscriptionEventsResponseSchema,
        );
        return answer.events.map(toPaymentEvent);
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
    // The store endpoint is outside the signed protocol (its own Bearer), so it is only spoken
    // when the server holds that key - the app never sees it.
    if (options.playSecret) {
      const playSecret = options.playSecret;
      this.verifyPlayPurchase = async (request) => this.callPlayVerify(request, playSecret);
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
      // A store method can only be sold if this server holds the key to check its purchases with.
      const sellable = answer.methods.filter(
        (method) => (method.flow ?? 'redirect') !== 'native' || this.verifyPlayPurchase,
      );
      this.methods.set(currency, { at: this.now(), methods: sellable });
      return sellable;
    } catch (error) {
      // A connector that blinked does not take the plan screen down with it: the last list it gave still stands.
      if (cached) return cached.methods;
      throw error;
    }
  }

  /**
   * Asks the connector whether a store purchase token is real. Plain HTTPS with the endpoint's own
   * Bearer - deliberately outside the signed calls above, which carry the connector's other keys.
   */
  private async callPlayVerify(
    request: PlayVerifyRequest,
    playSecret: string,
  ): Promise<PlayVerifyResponse> {
    const url = new URL('v1/play/verify', this.baseUrl).toString();
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${playSecret}`,
        },
        body: JSON.stringify(request),
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new ConnectorError(
        timedOut
          ? `The payment connector did not answer in ${this.timeoutMs} ms.`
          : 'The payment connector could not be reached.',
        timedOut ? 'timeout' : 'transport',
      );
    }
    if (!response.ok) {
      throw new ConnectorError(
        `The payment connector refused the store purchase (${response.status}).`,
        'status',
        response.status,
      );
    }
    const parsed = PlayVerifyResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new ConnectorError('The payment connector answered outside the contract.', 'invalid');
    }
    return {
      active: parsed.data.active,
      ...(parsed.data.orderId ? { orderId: parsed.data.orderId } : {}),
    };
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
