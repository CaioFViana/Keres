import type { PublicTier, PublicTiersResponse, Subscription } from '@keres/shared';
import type { BillingInterval } from '@keres/shared/payments/PaymentConnector';
import { PAYMENT_WARNING_DAYS } from '@keres/shared/metadata/Payments';
import { daysUntil } from '@keres/shared/utils/billingPeriod';

/** One plan a person can pay for, with the ways it is sold. */
export interface PlanOffer {
  tier: PublicTier;
  /** Only the intervals that have a price above zero. */
  prices: { interval: BillingInterval; cents: number }[];
}

/**
 * The plans worth offering for payment: those priced above zero in at least one interval. The free plan and
 * the ones not priced are not "bought", so they are not in the list.
 */
export function offersFrom(plans: PublicTiersResponse | null | undefined): PlanOffer[] {
  if (!plans) return [];
  const offers: PlanOffer[] = [];
  for (const tier of plans.tiers) {
    const prices: PlanOffer['prices'] = [];
    if (tier.priceMonthlyCents && tier.priceMonthlyCents > 0) {
      prices.push({ interval: 'monthly', cents: tier.priceMonthlyCents });
    }
    if (tier.priceYearlyCents && tier.priceYearlyCents > 0) {
      prices.push({ interval: 'yearly', cents: tier.priceYearlyCents });
    }
    if (prices.length > 0) offers.push({ tier, prices });
  }
  return offers;
}

/** An amount in minor units as money in the user's language; a currency the platform does not know stays plain. */
export function formatMoney(cents: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export type PaymentNotice =
  | { kind: 'none' }
  /** A paid period that will renew is about to end: the payment is coming up. */
  | { kind: 'soon'; daysLeft: number }
  /** The period ran out unpaid: the plan is no longer granted until it is paid. */
  | { kind: 'due' };

/**
 * Whether the user should be reminded about a payment. A subscription that will not renew has nothing to pay,
 * so it is never a reminder; one that is paid up with time left is not either.
 */
export function evaluatePaymentNotice(
  subscription: Pick<Subscription, 'status' | 'paidUntil' | 'cancelAtPeriodEnd'> | null,
  now: Date = new Date(),
): PaymentNotice {
  if (!subscription) return { kind: 'none' };
  if (subscription.status === 'due') return { kind: 'due' };
  if (subscription.status !== 'active' || subscription.cancelAtPeriodEnd) return { kind: 'none' };
  const daysLeft = daysUntil(new Date(subscription.paidUntil), now);
  return daysLeft <= PAYMENT_WARNING_DAYS ? { kind: 'soon', daysLeft } : { kind: 'none' };
}
