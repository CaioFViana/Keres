import { and, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import { env } from '../../config/env';
import { db, withWriteTransaction } from '../../db';
import {
  paymentCheckouts,
  paymentEvents,
  paymentSubscriptions,
  playPurchaseClaims,
  users,
} from '../../db/schema';
import { logger } from '../../utils/logger';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A run takes this many accounts at most: a backlog is worked off over the next runs. */
const PER_RUN = 100;

/**
 * Lets go of what points at a person once their account has been closed long enough. The ledger is the record of
 * what the server received, so it keeps its lines - what was paid, for which plan, when - but loses the person and
 * the provider's own reference; the subscription, the attempts and the store claims, which exist only to serve the
 * person, are deleted. Off unless `PAYMENT_RETENTION_DAYS` is set, and never touches an account that still has a
 * subscription the provider may charge.
 */
export class PaymentRetentionService {
  async run(now = new Date(), days = env.PAYMENT_RETENTION_DAYS): Promise<{ accounts: number }> {
    if (!days) return { accounts: 0 };
    const cutoff = new Date(now.getTime() - days * DAY_MS);

    // Closed long enough, and still tied to something.
    const withLedger = await db
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(paymentEvents, eq(paymentEvents.userId, users.id))
      .where(
        and(eq(users.isDeleted, true), isNotNull(users.deletedAt), lte(users.deletedAt, cutoff)),
      )
      .limit(PER_RUN);
    const withAttempts = await db
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(paymentCheckouts, eq(paymentCheckouts.userId, users.id))
      .where(
        and(eq(users.isDeleted, true), isNotNull(users.deletedAt), lte(users.deletedAt, cutoff)),
      )
      .limit(PER_RUN);
    const ids = [...new Set([...withLedger, ...withAttempts].map((row) => row.id))].slice(
      0,
      PER_RUN,
    );
    if (ids.length === 0) return { accounts: 0 };

    // One that may still be charged is left alone: it has to end first.
    const live = await db
      .select({ userId: paymentSubscriptions.userId })
      .from(paymentSubscriptions)
      .where(
        and(
          inArray(paymentSubscriptions.userId, ids),
          inArray(paymentSubscriptions.status, ['active', 'due']),
        ),
      );
    const stillCharging = new Set(live.map((row) => row.userId));
    const releasable = ids.filter((id) => !stillCharging.has(id));
    if (releasable.length === 0) return { accounts: 0 };

    await withWriteTransaction(async (tx) => {
      await tx.delete(paymentCheckouts).where(inArray(paymentCheckouts.userId, releasable));
      await tx.delete(paymentSubscriptions).where(inArray(paymentSubscriptions.userId, releasable));
      await tx.delete(playPurchaseClaims).where(inArray(playPurchaseClaims.userId, releasable));
      await tx
        .update(paymentEvents)
        .set({ userId: null, providerReference: null })
        .where(inArray(paymentEvents.userId, releasable));
    });
    logger.info(`Payments: released the records of ${releasable.length} closed account(s).`);
    return { accounts: releasable.length };
  }
}

export const paymentRetentionService = new PaymentRetentionService();
