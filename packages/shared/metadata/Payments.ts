/**
 * Constants of the payments feature. Plain values, no zod, so the admin panel and the client can import them
 * by subpath (`@keres/shared/metadata/Payments`) without the validation library.
 */

export const BILLING_INTERVALS = ['monthly', 'yearly'] as const;

/**
 * Where a subscription stands:
 *   - `active`: paid up to `paidUntil`, which is still ahead;
 *   - `due`: `paidUntil` passed with no new payment. The plan is no longer granted, and the subscription is
 *     marked to be charged: a payment that arrives now brings it back;
 *   - `canceled`: ended, either by the person (it ran out its last paid period) or by the provider.
 */
export const SUBSCRIPTION_STATUSES = ['active', 'due', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** How an attempt to pay ended (or has not yet). */
export const CHECKOUT_STATUSES = ['pending', 'paid', 'failed', 'expired'] as const;
export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

/** What the ledger of payments records. */
export const PAYMENT_LEDGER_KINDS = [
  'payment_succeeded',
  'payment_failed',
  'subscription_canceled',
  'subscription_due',
  'checkout_expired',
  'gift_granted',
] as const;
export type PaymentLedgerKind = (typeof PAYMENT_LEDGER_KINDS)[number];

/**
 * The `providerId` of a subscription that is a plan given by an administrator: a period paid for with nothing, by
 * the same rules as one paid with money (it extends a running period, and what is paid for afterwards extends it).
 * No provider charges it, so it never renews: it ends on its date.
 */
export const GIFT_PROVIDER_ID = 'admin';

/** The most months an administrator can give at once. */
export const GIFT_MAX_MONTHS = 24;

/** How many days before a paid period ends the client may remind the person (if they allowed it). */
export const PAYMENT_WARNING_DAYS = 5;

/** The longest a payment attempt stays open when the plugin does not say, in hours. */
export const CHECKOUT_DEFAULT_LIFETIME_HOURS = 24;
