/**
 * What Keres asks of a payment connector, and what a connector tells Keres.
 *
 * Keres does not charge anybody itself. A server that wants to sell its plans runs a **payment connector**: a
 * separate service that speaks to one payment provider and to Keres over HTTP (see `docs/payment_connectors.md`).
 * Nothing of a connector is loaded into the server, and a connector imports nothing of Keres: this file is the
 * shape of the messages, and the same shapes are published as JSON Schema for any language.
 *
 * What the contract rules out, on purpose:
 *   - No card number, expiry, security code, bank account or any other way to pay ever crosses it, in either
 *     direction. The person enters those at the provider (a hosted page, the provider's own app) - the
 *     connector sends them there with a `redirect`, or tells them what to do with `instructions`.
 *   - Keres stores what it needs to know what the person may use: the plan, the period, the status, the
 *     provider's own reference for the payment and for the subscription, and the amount. Nothing else.
 *   - The connector is never handed an e-mail address or anything about the person beyond an id and a name:
 *     whatever else the provider needs, it asks the person for itself.
 *
 * Renewals are the provider's: it keeps the subscription and charges when due, and tells Keres through the
 * events it sends. Keres keeps the date up to which each period is paid (a month paid on the 3rd lasts until
 * the 3rd of the next month) and marks the subscription as due once that date passes without a new payment;
 * `onSubscriptionDue` then lets the connector chase it if its provider needs a nudge.
 */

/** The version of the connector contract this Keres speaks. A connector says which one it implements. */
export const CONNECTOR_API_VERSION = 1;

/** The optional parts of the contract a connector may implement, and says it does in its `/v1/info`. */
export const CONNECTOR_CAPABILITIES = ['status', 'cancel', 'due'] as const;
export type ConnectorCapability = (typeof CONNECTOR_CAPABILITIES)[number];

/** How often a plan is paid for. */
export type BillingInterval = 'monthly' | 'yearly';

export interface PaymentPayer {
  userId: string;
  username: string;
}

/** One way to pay, as the person will see it in the list of choices. */
export interface PaymentMethodOption {
  /** Stable, the connector's own (`card`, `pix`, `boleto`...). */
  id: string;
  /** Plain text in the connector's language(s): Keres shows it as it is. */
  label: string;
  /** A line under the label, when the method needs one. */
  description?: string;
  /**
   * Whether the provider charges this method again by itself every period (a saved card). Defaults to true. Say
   * `false` for what the person has to pay again each time (PIX, boleto, a bank transfer): the app then tells them
   * so, and does not talk of "stopping the renewal" - there is nothing to stop.
   */
  recurring?: boolean;
}

export interface CheckoutRequest {
  /** Keres' id of this attempt. Use it as the idempotency key and as the client reference at the provider. */
  checkoutId: string;
  payer: PaymentPayer;
  tier: { id: string; name: string };
  interval: BillingInterval;
  /** In the minor unit of `currency` (cents). */
  amountCents: number;
  /** ISO-4217. */
  currency: string;
  methodId: string;
  /** The language the person uses, for the provider's page and messages. */
  language: string;
}

/**
 * What the person has to do next. Keres has one generic screen for all of them, so a connector never needs
 * code in the app.
 */
export type PaymentAction =
  /** Open this address (the provider's hosted checkout, the bank's page). `https`, unless Keres was told otherwise. */
  | { kind: 'redirect'; url: string }
  /** Nothing to open: tell them what to do. `copyText` is what they would copy (a PIX code, a reference). */
  | {
      kind: 'instructions';
      title: string;
      text: string;
      copyText?: string;
    }
  /** Nothing to do: the provider charges a method it already has, and reports the result with an event. */
  | { kind: 'none' };

export interface CheckoutResult {
  /** The provider's id for this payment. Kept, shown to the administrators, never interpreted. */
  providerReference: string;
  action: PaymentAction;
  /** When the offer stops being payable (a PIX code, a boleto). Past it the attempt is closed. */
  expiresAt?: Date;
}

/**
 * What the provider tells Keres, once the connector has checked it is really the provider speaking and put it
 * in these terms. `eventId` is the provider's id for the fact: the same one arriving twice (connectors and
 * providers retry) is counted once, so it must be the same every time the same fact is reported.
 */
export type PaymentEvent =
  | {
      type: 'payment.succeeded';
      eventId: string;
      /** The attempt it belongs to, for a first payment. */
      checkoutId?: string;
      /** The provider's subscription, for a first payment (it is kept) and for every renewal after it. */
      subscriptionReference?: string;
      paidAt: Date;
      amountCents: number;
      currency: string;
    }
  | {
      type: 'payment.failed';
      eventId: string;
      checkoutId?: string;
      subscriptionReference?: string;
      /** Short and free of anything personal: it is shown to the administrators. */
      reason?: string;
    }
  | { type: 'subscription.canceled'; eventId: string; subscriptionReference: string }
  | { type: 'checkout.expired'; eventId: string; checkoutId: string };

export interface DueSubscription {
  payer: PaymentPayer;
  tier: { id: string; name: string };
  interval: BillingInterval;
  amountCents: number;
  currency: string;
  /** The provider's subscription, when it has one. */
  subscriptionReference?: string;
  /** The date up to which the last period was paid. */
  paidUntil: Date;
}

/**
 * The connector as the rest of the server sees it. The only implementation is the one that speaks the HTTP contract
 * (`HttpConnector`); this interface is the seam the subscriptions, checkouts and tests are written against.
 */
export interface PaymentConnector {
  /** Stable and short (`stripe`, `mercadopago`): kept with every subscription, so it must never change. */
  readonly id: string;
  /** What the person sees ("Pay with Acme"). */
  readonly displayName: string;

  /** The ways to pay a price in `currency`; empty when the provider cannot take that currency. */
  listMethods(currency: string): Promise<PaymentMethodOption[]> | PaymentMethodOption[];

  /** Starts a payment. Anything it throws reaches the person as "could not start the payment". */
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;

  /**
   * Asks the provider how an attempt ended, for a provider that cannot be relied on to send the event. Null while
   * it is still open. Optional (capability `status`).
   */
  getCheckoutStatus?(checkoutId: string, providerReference: string): Promise<PaymentEvent | null>;

  /** Stops the provider charging the subscription again. Optional (capability `cancel`). */
  cancelSubscription?(subscriptionReference: string): Promise<void>;

  /** Called once when a period passes unpaid, so the provider can chase it. Optional (capability `due`). */
  onSubscriptionDue?(subscription: DueSubscription): Promise<void>;
}
