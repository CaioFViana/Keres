import { and, eq, inArray, lte } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, withWriteTransaction } from '../../db';
import { paymentCheckouts, paymentEvents, paymentSubscriptions, users } from '../../db/schema';
import { emitUserEvent } from '../../modules/webSocket/webSocket.route';
import { logger } from '../../utils/logger';
import { auditService } from '../AuditService';
import { lapsedCondition } from './entitlement';
import { noteLedger, tierNameOf } from './paymentLedger';
import { getPaymentConnector } from './PaymentConnectorRegistry';

/** A period left unpaid this long ends the subscription for good: the administrators' list does not fill with them. */
export const DUE_ABANDONED_AFTER_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

const notify = (userId: string): void => emitUserEvent(userId, { type: 'payments.changed' });

/**
 * Marks the subscriptions whose paid period ran out. A cancelled one ends; any other becomes `due`, the
 * plugin is told once so its provider can chase it, and one left unpaid for `DUE_ABANDONED_AFTER_DAYS`
 * ends too. Safe to run as often as wanted - it only acts on what changed.
 */
export async function markSubscriptionsDue(
  now = new Date(),
): Promise<{ due: number; ended: number }> {
  const plugin = getPaymentConnector();
  let due = 0;
  let ended = 0;

  const lapsed = await db
    .select()
    .from(paymentSubscriptions)
    .where(and(eq(paymentSubscriptions.status, 'active'), lapsedCondition(now)));
  for (const row of lapsed) {
    const tierName = await tierNameOf(row.tierId);
    const ending = row.cancelAtPeriodEnd;
    const done = await withWriteTransaction(async (tx) => {
      // The row may have been paid since it was read: only a still-active, still-lapsed one changes.
      const changed = await tx
        .update(paymentSubscriptions)
        .set({ status: ending ? 'canceled' : 'due', updatedAt: now })
        .where(
          and(
            eq(paymentSubscriptions.userId, row.userId),
            eq(paymentSubscriptions.status, 'active'),
            lapsedCondition(now),
          ),
        )
        .returning({ userId: paymentSubscriptions.userId });
      if (changed.length === 0) return false;
      await noteLedger(tx, {
        providerId: row.providerId,
        kind: ending ? 'subscription_canceled' : 'subscription_due',
        userId: row.userId,
        tierName,
        amountCents: row.amountCents,
        currency: row.currency,
        providerReference: row.providerReference,
        detail: ending ? 'The paid period ended.' : `Paid until ${row.paidUntil.toISOString()}.`,
      });
      return true;
    });
    if (!done) continue;
    if (ending) ended += 1;
    else due += 1;
    notify(row.userId);
    auditService.record({
      category: 'payment',
      action: ending ? 'payment.subscription_canceled' : 'payment.subscription_due',
      subjectUserId: row.userId,
      meta: { tier: tierName, paidUntil: row.paidUntil.toISOString() },
    });
  }

  const waiting = await db
    .select()
    .from(paymentSubscriptions)
    .where(eq(paymentSubscriptions.status, 'due'));
  for (const row of waiting) {
    if (now.getTime() - row.paidUntil.getTime() > DUE_ABANDONED_AFTER_DAYS * DAY_MS) {
      await db
        .update(paymentSubscriptions)
        .set({ status: 'canceled', updatedAt: now })
        .where(
          and(eq(paymentSubscriptions.userId, row.userId), eq(paymentSubscriptions.status, 'due')),
        );
      await db.insert(paymentEvents).values({
        id: ulid(),
        providerId: row.providerId,
        kind: 'subscription_canceled',
        userId: row.userId,
        tierName: await tierNameOf(row.tierId),
        providerReference: row.providerReference,
        detail: `Unpaid for ${DUE_ABANDONED_AFTER_DAYS} days.`,
      });
      ended += 1;
      notify(row.userId);
      continue;
    }
    if (row.dueNotifiedAt || !plugin?.onSubscriptionDue || row.providerId !== plugin.id) continue;
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, row.userId),
        columns: { id: true, username: true },
      });
      await plugin.onSubscriptionDue({
        payer: { userId: row.userId, username: user?.username ?? '' },
        tier: { id: row.tierId, name: await tierNameOf(row.tierId) },
        interval: row.interval,
        amountCents: row.amountCents,
        currency: row.currency,
        subscriptionReference: row.providerReference ?? undefined,
        paidUntil: row.paidUntil,
      });
      await db
        .update(paymentSubscriptions)
        .set({ dueNotifiedAt: now })
        .where(eq(paymentSubscriptions.userId, row.userId));
    } catch (error) {
      // Retried on the next run; the plan is already not granted, so nothing depends on it.
      logger.error('Payment plugin failed on a subscription that is due', error);
    }
  }

  // Attempts nobody finished stop being payable.
  const open = await db
    .select({ id: paymentCheckouts.id })
    .from(paymentCheckouts)
    .where(and(eq(paymentCheckouts.status, 'pending'), lte(paymentCheckouts.expiresAt, now)));
  if (open.length > 0) {
    await db
      .update(paymentCheckouts)
      .set({ status: 'expired', action: null, updatedAt: now })
      .where(
        inArray(
          paymentCheckouts.id,
          open.map((row) => row.id),
        ),
      );
  }
  return { due, ended };
}
