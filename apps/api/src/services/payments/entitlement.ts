import { and, eq, gt, inArray, ne } from 'drizzle-orm';
import { db } from '../../db';
import { paymentSubscriptions } from '../../db/schema';

/**
 * The plan this person's payments entitle them to right now, or null: a subscription that is not cancelled
 * and whose paid period is still ahead. Read from the date itself, not from the `status` column, so a plan
 * stops being granted at the moment the period ends and not whenever the periodic job next runs.
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
      gt(paymentSubscriptions.paidUntil, now),
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
        gt(paymentSubscriptions.paidUntil, now),
      ),
    );
  return new Map(rows.map((row) => [row.userId, row.tierId]));
}
