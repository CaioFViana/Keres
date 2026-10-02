import { and, eq, gt, ne } from 'drizzle-orm';
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
