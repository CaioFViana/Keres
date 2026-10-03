import {
  convertedPeriodStart,
  dailyCents,
  nextPeriodStart,
  wholeDays,
} from '@keres/shared/utils/billingPeriod';
import type { BillingInterval } from '@keres/shared/payments/PaymentPlugin';
import { eq } from 'drizzle-orm';
import type { CompatibleDb } from '../../db';
import { type paymentSubscriptions, tiers } from '../../db/schema';
import { tierNameOf } from './paymentLedger';

type SubscriptionRow = typeof paymentSubscriptions.$inferSelect;

/**
 * What a day of the plan a subscription is on is worth, for converting its remaining time into another plan's.
 * The plan's list price for the subscription's interval, and not what was last paid: a plan given by hand
 * was paid nothing and its time is still worth something, and a discount does not make time worth less.
 */
export async function dailyValueOf(tx: CompatibleDb, row: SubscriptionRow): Promise<number> {
  const tier = await tx.query.tiers.findFirst({
    where: eq(tiers.id, row.tierId),
    columns: { priceMonthlyCents: true, priceYearlyCents: true },
  });
  const listed = row.interval === 'yearly' ? tier?.priceYearlyCents : tier?.priceMonthlyCents;
  return dailyCents(listed || row.amountCents, row.interval);
}

/**
 * Where the period that a payment buys starts: from the end of the running one for the same plan (paying early
 * loses nothing), from the payment for a lapsed one, and - when the person changes plan while time is left -
 * from the point the remaining time is worth at the new plan's price (see `convertedPeriodStart`).
 */
export async function periodStartFor(
  tx: CompatibleDb,
  existing: SubscriptionRow | undefined,
  next: { tierId: string; interval: BillingInterval; amountCents: number },
  paidAt: Date,
): Promise<{
  start: Date;
  conversion: { fromTierName: string; remainingDays: number; convertedDays: number } | null;
}> {
  const running = existing && existing.status === 'active' && existing.paidUntil > paidAt;
  if (!existing || !running || existing.tierId === next.tierId) {
    return {
      start: nextPeriodStart(
        existing && existing.status === 'active' ? existing.paidUntil : null,
        paidAt,
      ),
      conversion: null,
    };
  }
  const start = convertedPeriodStart(
    paidAt,
    existing.paidUntil,
    await dailyValueOf(tx, existing),
    dailyCents(next.amountCents, next.interval),
  );
  return {
    start,
    conversion: {
      fromTierName: await tierNameOf(existing.tierId),
      remainingDays: wholeDays(existing.paidUntil.getTime() - paidAt.getTime()),
      convertedDays: wholeDays(start.getTime() - paidAt.getTime()),
    },
  };
}
