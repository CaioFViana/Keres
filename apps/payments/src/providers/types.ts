import type { PaymentsConfig } from '../config';
import type {
  CheckoutRequestWire,
  CheckoutResultWire,
  PaymentEventWire,
  PaymentMethodOptionInput,
} from '../wire';

/** What a provider remembers about an attempt it started. */
export interface CheckoutRecord {
  methodId: string;
  providerReference: string;
  subscriptionReference?: string;
  amountCents?: number;
  currency?: string;
  tierName?: string;
}

/** In-memory attempt registry. Single-replica state: status can always be re-derived from the
 * provider by reference, so losing it only costs a lookup, never money. */
export class CheckoutStore {
  private readonly records = new Map<string, CheckoutRecord>();

  remember(checkoutId: string, record: CheckoutRecord): void {
    this.records.set(checkoutId, record);
  }

  recall(checkoutId: string): CheckoutRecord | undefined {
    return this.records.get(checkoutId);
  }

  entries(): IterableIterator<[string, CheckoutRecord]> {
    return this.records.entries();
  }
}

export interface ProviderContext {
  config: PaymentsConfig;
  store: CheckoutStore;
  fetchImpl: typeof fetch;
  /** Reports provider facts to Keres (signed event push). */
  report: (events: PaymentEventWire[]) => Promise<void>;
}

/** One payment provider behind one or more method ids. */
export interface Provider {
  /** The method ids this provider answers for (`paypal`, `googlepay`). */
  readonly methodIds: readonly string[];
  readonly hasStatus: boolean;
  readonly hasCancel: boolean;
  methods(currency: string): PaymentMethodOptionInput[];
  createCheckout(
    request: CheckoutRequestWire,
    context: ProviderContext,
  ): Promise<CheckoutResultWire>;
  getStatus?(
    checkoutId: string,
    providerReference: string,
    context: ProviderContext,
  ): Promise<PaymentEventWire | null>;
  cancelSubscription?(subscriptionReference: string, context: ProviderContext): Promise<void>;
  /**
   * Whether a subscription reference is one of this provider's. A cancel arrives with the reference
   * alone, so with more than one provider it is the only way to send it to the one that holds it.
   */
  ownsSubscription?(subscriptionReference: string): boolean;
  /**
   * Whether a checkout's provider reference (what `createCheckout` answered) is one of this provider's. A
   * status question after this service restarted names only the reference, because what was remembered
   * about the attempt is gone: the reference is how the right provider is found without asking them all.
   */
  ownsCheckoutReference?(providerReference: string): boolean;
  /** Provider webhooks (`POST /v1/<provider>/webhook`): verifies and translates to events. */
  handleWebhook?(request: Request, context: ProviderContext): Promise<PaymentEventWire[]>;
}
