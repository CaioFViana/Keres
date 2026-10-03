/**
 * The contract of a payment plugin.
 *
 * Keres does not charge anybody itself. A server that wants to sell its plans installs a plugin - a module
 * that speaks to one payment provider - and everything money-related happens between that provider and the
 * person paying. Keres only asks the plugin for a way to pay, and listens for what the provider reports.
 * This file is that contract and nothing else: it holds no provider, and a server with no plugin works
 * exactly as it did, with plans handed out by the administrators.
 *
 * Plugins are not part of Keres and are not covered by its licence: each fork or operator brings its own
 * (`PAYMENT_PLUGIN` names the module). They import only this file, as types.
 *
 * What the contract rules out, on purpose:
 *   - No card number, expiry, security code, bank account or any other way to pay ever crosses it, in either
 *     direction. The person enters those at the provider (a hosted page, the provider's own app) - the
 *     plugin sends them there with a `redirect`, or tells them what to do with `instructions`.
 *   - Keres stores what it needs to know what the person may use: the plan, the period, the status, the
 *     provider's own reference for the payment and for the subscription, and the amount. Nothing else.
 *   - The plugin is never handed an e-mail address or anything about the person beyond an id and a name:
 *     whatever else the provider needs, it asks the person for itself.
 *
 * Renewals are the provider's: it keeps the subscription and charges when due, and tells Keres through
 * `handleWebhook`. Keres keeps the date up to which each period is paid (a month paid on the 3rd lasts
 * until the 3rd of the next month) and marks the subscription as due once that date passes without a new
 * payment; `onSubscriptionDue` then lets the plugin chase it if its provider needs a nudge.
 */

/** How often a plan is paid for. */
export type BillingInterval = 'monthly' | 'yearly';

export interface PaymentPayer {
  userId: string;
  username: string;
}

/** One way to pay, as the person will see it in the list of choices. */
export interface PaymentMethodOption {
  /** Stable, the plugin's own (`card`, `pix`, `boleto`...). */
  id: string;
  /** Plain text in the plugin's language(s): Keres shows it as it is. */
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
 * What the person has to do next. Keres has one generic screen for all of them, so a plugin never needs
 * code in the app.
 */
export type PaymentAction =
  /** Open this address (the provider's hosted checkout, the bank's page). Always `https`. */
  | { kind: 'redirect'; url: string }
  /** Nothing to open: tell them what to do. `copyText` is what they would copy (a PIX code, a reference). */
  | {
      kind: 'instructions';
      title: string;
      text: string;
      copyText?: string;
    }
  /** Nothing to do: the provider charges a method it already has, and reports the result by webhook. */
  | { kind: 'none' };

export interface CheckoutResult {
  /** The provider's id for this payment. Kept, shown to the administrators, never interpreted. */
  providerReference: string;
  action: PaymentAction;
  /** When the offer stops being payable (a PIX code, a boleto). Past it the attempt is closed. */
  expiresAt?: Date;
}

/**
 * What the provider tells Keres, once the plugin has checked it is really the provider speaking and put it
 * in these terms. `eventId` is the provider's id for the notification itself: the same one arriving twice
 * (providers retry) is counted once.
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

export interface WebhookRequest {
  /** Lower-cased names. */
  headers: Record<string, string>;
  /** The body exactly as received: a signature is computed over these bytes, not over a parsed copy. */
  rawBody: string;
}

/** Thrown by `handleWebhook` when the request is not the provider's (bad signature, wrong shape): it is refused. */
export class PaymentWebhookRejectedError extends Error {
  constructor(message = 'Webhook rejected') {
    super(message);
    this.name = 'PaymentWebhookRejectedError';
  }
}

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

export interface PaymentPlugin {
  /** Stable and short (`stripe`, `mercadopago`): kept with every subscription, so do not rename it. */
  readonly id: string;
  /** What the person sees ("Pay with Acme"). */
  readonly displayName: string;

  /** The ways to pay a price in `currency`; empty when the provider cannot take that currency. */
  listMethods(currency: string): Promise<PaymentMethodOption[]> | PaymentMethodOption[];

  /** Starts a payment. Anything it throws reaches the person as "could not start the payment". */
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;

  /**
   * Reads a notification from the provider. Returns what it means for Keres (an empty list for what does
   * not concern it) and throws `PaymentWebhookRejectedError` when the request is not authentic.
   */
  handleWebhook(request: WebhookRequest): Promise<PaymentEvent[]>;

  /**
   * Asks the provider how an attempt ended, for a provider that cannot be relied on to call the webhook.
   * Null while it is still open. Optional.
   */
  getCheckoutStatus?(checkoutId: string, providerReference: string): Promise<PaymentEvent | null>;

  /** Stops the provider charging the subscription again. Optional; without it the person is told to cancel at the provider. */
  cancelSubscription?(subscriptionReference: string): Promise<void>;

  /** Called once when a period passes unpaid, so the provider can chase it. Optional; failures are logged and ignored. */
  onSubscriptionDue?(subscription: DueSubscription): Promise<void>;
}

/** What a plugin gets when it is created. */
export interface PaymentPluginContext {
  /** The environment: a plugin reads its own keys from it, Keres never looks at them. */
  env: Record<string, string | undefined>;
  log: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, error?: unknown, meta?: Record<string, unknown>) => void;
  };
}

export type PaymentPluginFactory = (
  context: PaymentPluginContext,
) => PaymentPlugin | Promise<PaymentPlugin>;
