import type { PaymentEvent } from '@keres/shared/payments/PaymentConnector';

type Succeeded = Extract<PaymentEvent, { type: 'payment.succeeded' }>;

interface Subscription {
  providerReference: string | null;
  lastPaymentAt: Date | null;
  amountCents: number;
  cancelAtPeriodEnd: boolean;
}
interface Attempt {
  status: string;
}

/** How close two announcements of one charge are, whatever they name it. */
export const SAME_CHARGE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Whether a payment notice is one the subscription already took under another id. Providers announce a charge
 * through several doors (a webhook, a return page, the invoice behind a session) and the ids are meant to agree,
 * but they are the provider's to name: two ids for one charge would grant the period twice. The same
 * subscription, the same amount, minutes apart, with no new attempt behind it, is one charge.
 */
export function isSameChargeAgain(
  existing: Subscription | null | undefined,
  checkout: Attempt | null | undefined,
  event: Succeeded,
  subscriptionReference: string | undefined,
): boolean {
  if (!existing?.providerReference || !existing.lastPaymentAt || !subscriptionReference)
    return false;
  if (existing.providerReference !== subscriptionReference) return false;
  // A new attempt (somebody paying again, maybe for another plan) is a payment of its own.
  if (checkout && checkout.status !== 'paid') return false;
  return (
    existing.amountCents === event.amountCents &&
    Math.abs(event.paidAt.getTime() - existing.lastPaymentAt.getTime()) <= SAME_CHARGE_WINDOW_MS
  );
}

/** A payment that belongs to a subscription already running, not to somebody starting (or restarting) one. */
export function isRenewal(
  existing: Subscription | null | undefined,
  checkout: Attempt | null | undefined,
  subscriptionReference: string | undefined,
): boolean {
  if (!existing) return false;
  if (checkout && checkout.status !== 'paid') return false;
  if (
    subscriptionReference &&
    existing.providerReference &&
    existing.providerReference !== subscriptionReference
  ) {
    return false;
  }
  return true;
}

/**
 * Whether a payment lifts a subscription's "will not renew". Only somebody subscribing again does (a new attempt, a
 * new subscription at the provider): a renewal notice that arrives late - after the cancellation that was
 * announced next to it - must not bring a cancelled subscription back.
 */
export function liftsCancellation(
  existing: Subscription | null | undefined,
  checkout: Attempt | null | undefined,
  subscriptionReference: string | undefined,
): boolean {
  return !isRenewal(existing, checkout, subscriptionReference);
}

/**
 * A reference to look a payment up at the provider, made short enough to show: a store purchase token is a
 * credential for the purchase and runs to hundreds of characters, so the administrators see its ends only. The
 * ids of the other providers are short and are shown whole.
 */
export function maskReference(reference: string | null): string | null {
  if (!reference || reference.length <= 60) return reference;
  return `${reference.slice(0, 8)}...${reference.slice(-6)}`;
}
