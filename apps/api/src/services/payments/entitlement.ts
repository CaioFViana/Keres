import { GIFT_PROVIDER_ID, PAYMENT_RENEWAL_GRACE_HOURS } from '@keres/shared/metadata/Payments';
import { and, eq, gt, inArray, lte, ne, or, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { paymentSubscriptions } from '../../db/schema';

const HOUR_MS = 60 * 60 * 1000;

/** The moment before which a renewing subscription is past even its margin (`PAYMENT_RENEWAL_GRACE_HOURS`). */
export const graceCutoff = (now: Date): Date =>
  new Date(now.getTime() - PAYMENT_RENEWAL_GRACE_HOURS * HOUR_MS);

/** A subscription that ends exactly on its date: cancelled, ending, or a plan given by an administrator. */
const endsOnItsDate = (): SQL =>
  or(
    eq(paymentSubscriptions.cancelAtPeriodEnd, true),
    eq(paymentSubscriptions.providerId, GIFT_PROVIDER_ID),
  ) as SQL;

/**
 * Whose paid period is over: a subscription that ends on its date once that date passed, one that is still
 * renewing only once the margin after it has passed too. What the periodic job marks as due or ended.
 */
export const lapsedCondition = (now: Date): SQL =>
  or(
    and(endsOnItsDate(), lte(paymentSubscriptions.paidUntil, now)),
    and(
      eq(paymentSubscriptions.cancelAtPeriodEnd, false),
      ne(paymentSubscriptions.providerId, GIFT_PROVIDER_ID),
      lte(paymentSubscriptions.paidUntil, graceCutoff(now)),
    ),
  ) as SQL;

/** The opposite of `lapsedCondition`, for a subscription that is not cancelled: the plan is still granted. */
const stillGranted = (now: Date): SQL =>
  or(
    gt(paymentSubscriptions.paidUntil, now),
    and(
      eq(paymentSubscriptions.cancelAtPeriodEnd, false),
      ne(paymentSubscriptions.providerId, GIFT_PROVIDER_ID),
      gt(paymentSubscriptions.paidUntil, graceCutoff(now)),
    ),
  ) as SQL;

/**
 * The plan this person's payments entitle them to right now, or null: a subscription that is not cancelled
 * and whose paid period is still ahead - or, for one that is still renewing, only just behind (see
 * `PAYMENT_RENEWAL_GRACE_HOURS`). Read from the date itself, not from the `status` column, so a plan stops being
 * granted when the period ends and not whenever the periodic job next runs.
 *
 * Its own module, using only the database: the plan enforcement asks it on almost every write, and must not
 * reach the realtime and audit machinery the subscription service needs.
 */
export async function entitledTierId(
  userId: string,
  now: Date = new Date(),
): Promise<string | null> {
  const row = await db.query.paymentSubscriptions.findFirst({
    where: and(
      eq(paymentSubscriptions.userId, userId),
      ne(paymentSubscriptions.status, 'canceled'),
      stillGranted(now),
    ),
    columns: { tierId: true },
  });
  return row?.tierId ?? null;
}

/** `entitledTierId` for several people at once (the administrators' lists): who is paid up, and for which plan. */
export async function entitledTierIds(
  userIds: string[],
  now: Date = new Date(),
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: paymentSubscriptions.userId, tierId: paymentSubscriptions.tierId })
    .from(paymentSubscriptions)
    .where(
      and(
        inArray(paymentSubscriptions.userId, userIds),
        ne(paymentSubscriptions.status, 'canceled'),
        stillGranted(now),
      ),
    );
  return new Map(rows.map((row) => [row.userId, row.tierId]));
}
