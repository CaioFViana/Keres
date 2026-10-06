import type { PublicTier, PublicTiersResponse, Subscription } from '@keres/shared';
import type { BillingInterval, PaymentMethodOption } from '@keres/shared/payments/PaymentConnector';
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

/** The tier fields that say where a plan is sold: the store products and the web flags. */
export type TierSaleInfo = Pick<
  PublicTier,
  'playMonthlyProductId' | 'playYearlyProductId' | 'webMonthlyEnabled' | 'webYearlyEnabled'
>;

/**
 * The store product id selling this plan for this period (`null` when the plan is not sold in the
 * store). The app needs the id to open the purchase sheet; the server checks it again at the relay.
 */
export function playProductForOffer(tier: TierSaleInfo, interval: BillingInterval): string | null {
  const productId = interval === 'yearly' ? tier.playYearlyProductId : tier.playMonthlyProductId;
  return productId ?? null;
}

/**
 * Whether a method sells a plan for a period. A store method sells it when the plan names the product
 * for that period; a web method sells it when the plan says web checkouts sell that period (a plan
 * from a server predating the flags sells everywhere). The server enforces the same rule - this only
 * decides what the screen offers.
 */
export function isMethodSoldForOffer(
  method: Pick<PaymentMethodOption, 'flow'>,
  tier: TierSaleInfo,
  interval: BillingInterval,
): boolean {
  if ((method.flow ?? 'redirect') === 'native') {
    return playProductForOffer(tier, interval) !== null;
  }
  const webSold = interval === 'yearly' ? tier.webYearlyEnabled : tier.webMonthlyEnabled;
  return webSold ?? true;
}

/**
 * The plan and period a store product sells, for reconciling unfinished purchases. Takes only the
 * fields that name the sale (id plus the store products), so callers without the full plan work too.
 */
export function offerForPlayProduct(
  tiers: readonly Pick<PublicTier, 'id' | 'playMonthlyProductId' | 'playYearlyProductId'>[],
  productId: string,
): { tierId: string; interval: BillingInterval } | null {
  for (const tier of tiers) {
    if (tier.playMonthlyProductId === productId) return { tierId: tier.id, interval: 'monthly' };
    if (tier.playYearlyProductId === productId) return { tierId: tier.id, interval: 'yearly' };
  }
  return null;
}

export type PaymentNotice =
  | { kind: 'none' }
  /** A paid period that will renew is about to end: the payment is coming up. */
  | { kind: 'soon'; daysLeft: number }
  /** The period ran out unpaid: the plan is no longer granted until it is paid. */
  | { kind: 'due' };

/** A subscription that renews and whose date has passed, still granted by the server for a short margin. */
export function isRenewalBeingConfirmed(
  subscription: Pick<Subscription, 'status' | 'paidUntil' | 'cancelAtPeriodEnd' | 'complimentary'>,
  now: Date = new Date(),
): boolean {
  return (
    subscription.status === 'active' &&
    !subscription.cancelAtPeriodEnd &&
    !subscription.complimentary &&
    new Date(subscription.paidUntil).getTime() <= now.getTime()
  );
}

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
  // The date passed but the server still holds it as paid up: the renewal is being confirmed (the margin it gives
  // a late notice). Nothing is owed yet and nothing is lost - a reminder now would only be noise; if the renewal
  // does not come, the server marks it due and the "due" reminder follows.
  if (new Date(subscription.paidUntil).getTime() <= now.getTime()) return { kind: 'none' };
  const daysLeft = daysUntil(new Date(subscription.paidUntil), now);
  return daysLeft <= PAYMENT_WARNING_DAYS ? { kind: 'soon', daysLeft } : { kind: 'none' };
}
