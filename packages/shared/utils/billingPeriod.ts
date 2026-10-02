import type { BillingInterval } from '../payments/PaymentPlugin';

/**
 * The end of a paid period that starts at `from`: one month, or one year, later - on the same day of the
 * month when there is one, and on the last day of the month when there is not (a period that starts on the
 * 31st of January ends on the last day of February). A month paid on the 3rd lasts until the 3rd of the
 * next month. UTC, so the answer does not depend on where the server runs.
 */
export function addBillingPeriod(from: Date, interval: BillingInterval): Date {
  const months = interval === 'yearly' ? 12 : 1;
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
