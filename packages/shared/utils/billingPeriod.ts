import type { BillingInterval } from '../payments/PaymentPlugin';

/**
 * The end of a paid period that starts at `from`: one month, or one year, later - on the same day of the
 * month when there is one, and on the last day of the month when there is not (a period that starts on the
 * 31st of January ends on the last day of February). A month paid on the 3rd lasts until the 3rd of the
 * next month. UTC, so the answer does not depend on where the server runs.
 */
export function addBillingPeriod(from: Date, interval: BillingInterval): Date {
  return addBillingMonths(from, interval === 'yearly' ? 12 : 1);
}

/**
 * Where the next paid period starts. A payment that arrives while the last period is still running extends
 * it from where it ends (so paying early loses nothing); one that arrives after it ran out starts a new
 * period from the payment itself (so a late payment does not buy time that already went by).
 */
export function nextPeriodStart(currentPaidUntil: Date | null, paidAt: Date): Date {
  return currentPaidUntil && currentPaidUntil.getTime() > paidAt.getTime()
    ? currentPaidUntil
    : paidAt;
}

/** Whole days from `now` to `until`, rounded up; 0 or negative once it is today or past. */
export function daysUntil(until: Date, now: Date): number {
  return Math.ceil((until.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Average length of a period in days, so a monthly and a yearly price can be compared per day. */
export const BILLING_INTERVAL_DAYS: Record<BillingInterval, number> = {
  monthly: 365.25 / 12,
  yearly: 365.25,
};

/** What a day of a plan costs when it is paid for `priceCents` per `interval`. */
export function dailyCents(priceCents: number, interval: BillingInterval): number {
  return priceCents / BILLING_INTERVAL_DAYS[interval];
}

/**
 * Where a new paid period starts when the person changes plan while time is still left on the old one.
 *
 * The time left is not carried over day for day: that would let somebody pay a year of a cheap plan and a
 * month of an expensive one and have the expensive one for 13 months. It is worth what it cost (the old
 * plan's price per day), and that value buys days of the new plan (at its price per day): twenty days of a
 * R$ 25 plan are worth about seven days of a R$ 70 one. A plan with no price (nothing to value the time by)
 * converts to nothing.
 */
export function convertedPeriodStart(
  now: Date,
  paidUntil: Date,
  oldDailyCents: number,
  newDailyCents: number,
): Date {
  const remaining = paidUntil.getTime() - now.getTime();
  if (remaining <= 0 || oldDailyCents <= 0 || newDailyCents <= 0) return now;
  return new Date(now.getTime() + Math.floor(remaining * (oldDailyCents / newDailyCents)));
}

/** Whole days, rounded to the nearest, for the texts that say how much time converted into how much. */
export function wholeDays(milliseconds: number): number {
  return Math.round(milliseconds / DAY_MS);
}

/**
 * `months` calendar months after `from`, on the same day of the month when there is one and on the last day of
 * the month when there is not (the 31st of January plus one month is the last day of February). UTC.
 */
export function addBillingMonths(from: Date, months: number): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  const day = from.getUTCDate();
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, lastDayOfTarget),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
}
