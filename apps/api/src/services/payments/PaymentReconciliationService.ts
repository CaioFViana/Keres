import { GIFT_PROVIDER_ID } from '@keres/shared/metadata/Payments';
import type { PaymentEvent } from '@keres/shared/payments/PaymentConnector';
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, ne } from 'drizzle-orm';
import { db } from '../../db';
import { paymentCheckouts, paymentSubscriptions } from '../../db/schema';
import { logger } from '../../utils/logger';
import { auditService } from '../AuditService';
import { getPaymentConnector } from './PaymentConnectorRegistry';
import { isStoreMethod, subscriptionService } from './SubscriptionService';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A subscription this long past its date is asked about only now and then: it is not a notice that is merely late. */
const FRESH_OVERDUE_MS = 72 * HOUR_MS;
const STALE_ASK_EVERY_MS = 6 * HOUR_MS;
/** How far back an attempt that nobody saw finish is still looked for. */
const CHECKOUT_LOOKBACK_MS = 3 * DAY_MS;
const OLD_CHECKOUT_ASK_EVERY_MS = 3 * HOUR_MS;
/** The most one run asks the provider about: a backlog is worked off over the next runs, not in one burst. */
const MAX_SUBSCRIPTIONS_PER_RUN = 100;
const MAX_CHECKOUTS_PER_RUN = 50;

export interface ReconciliationOutcome {
  /** Subscriptions asked about, and attempts asked about. */
  subscriptions: number;
  checkouts: number;
  /** Notices that changed something (a payment found, an end noted). */
  applied: number;
}

const paidAtOf = (event: PaymentEvent): number =>
  event.type === 'payment.succeeded' ? event.paidAt.getTime() : Number.MAX_SAFE_INTEGER;

/**
 * The safety net under the webhooks. Everything the server learns about money comes as the provider's notices,
 * and a notice can fail to arrive: the connector was down longer than the provider keeps retrying, a webhook was
 * never set up, a deploy went wrong. Nothing in the notices themselves says one is missing - so the server asks.
 *
 *   - A subscription whose paid period ran out and that is still meant to renew (or is already late) is the sign
 *     of a renewal that did not arrive: the provider is asked what it charged since, and what it says is applied
 *     like a webhook would be (the same event ids, so what did arrive counts once).
 *   - An attempt that was opened and never seen to finish, still recent, is asked about as the person's screen
 *     would: the payment that was made while nobody was looking is found.
 *
 * Asked often while a renewal is merely late (it usually turns up on the next run) and rarely once it is not. The
 * asked-when memory is in this process only: a restart asks again, which costs a request and nothing else.
 */
export class PaymentReconciliationService {
  private readonly asked = new Map<string, number>();
  /** How the last run went, since this server started: what the administrators' health panel shows. */
  lastRun: (ReconciliationOutcome & { at: Date; failures: number }) | null = null;

  /** Whether `key` may be asked about now, noting that it is. `everyMs` 0 means every run. */
  private mayAsk(key: string, everyMs: number, now: Date): boolean {
    const last = this.asked.get(key);
    if (last !== undefined && now.getTime() - last < everyMs) return false;
    if (this.asked.size > 5000) {
      for (const [other, at] of this.asked) {
        if (now.getTime() - at > DAY_MS) this.asked.delete(other);
      }
    }
    this.asked.set(key, now.getTime());
    return true;
  }

  async run(now = new Date()): Promise<ReconciliationOutcome> {
    const outcome: ReconciliationOutcome = { subscriptions: 0, checkouts: 0, applied: 0 };
    let failures = 0;
    const plugin = getPaymentConnector();
    if (!plugin) return outcome;

    if (plugin.reconcileSubscription) {
      const reconcile = plugin.reconcileSubscription;
      const overdue = await db
        .select()
        .from(paymentSubscriptions)
        .where(
          and(
            eq(paymentSubscriptions.providerId, plugin.id),
            inArray(paymentSubscriptions.status, ['active', 'due']),
            // One that is already ending needs no renewal, and a gift never had one.
            eq(paymentSubscriptions.cancelAtPeriodEnd, false),
            ne(paymentSubscriptions.providerId, GIFT_PROVIDER_ID),
            isNotNull(paymentSubscriptions.providerReference),
            lte(paymentSubscriptions.paidUntil, now),
          ),
        )
        .orderBy(asc(paymentSubscriptions.paidUntil))
        .limit(MAX_SUBSCRIPTIONS_PER_RUN);

      for (const row of overdue) {
        const reference = row.providerReference as string;
        const overdueFor = now.getTime() - row.paidUntil.getTime();
        const every = overdueFor < FRESH_OVERDUE_MS ? 0 : STALE_ASK_EVERY_MS;
        if (!this.mayAsk(`subscription:${row.userId}`, every, now)) continue;
        // A subscription bought in a store is the store's to renew: its notices come from the store.
        if (isStoreMethod(await subscriptionService.lastMethod(row, plugin))) continue;
        outcome.subscriptions += 1;
        try {
          // A day before the last payment is plenty: a renewal after it is what is being looked for, and what
          // was already applied is recognised by its id.
          const since = new Date(
            (row.lastPaymentAt ?? new Date(row.paidUntil.getTime() - 35 * DAY_MS)).getTime() -
              DAY_MS,
          );
          const events = (await reconcile(reference, since)).sort(
            (a, b) => paidAtOf(a) - paidAtOf(b),
          );
          const outcomes = await subscriptionService.applyEvents(plugin, events, now);
          outcome.applied += outcomes.filter((entry) => entry === 'applied').length;
        } catch (error) {
          // One provider answer that failed must not stop the others, nor the job.
          failures += 1;
          logger.warn(
            `Payments: could not reconcile a subscription (${error instanceof Error ? error.message : 'failed'}).`,
          );
        }
      }
    }

    if (plugin.getCheckoutStatus) {
      const status = plugin.getCheckoutStatus;
      const open = await db
        .select()
        .from(paymentCheckouts)
        .where(
          and(
            eq(paymentCheckouts.providerId, plugin.id),
            inArray(paymentCheckouts.status, ['pending', 'expired']),
            // A store purchase has no provider session to ask about.
            isNotNull(paymentCheckouts.providerReference),
            gte(paymentCheckouts.createdAt, new Date(now.getTime() - CHECKOUT_LOOKBACK_MS)),
          ),
        )
        .orderBy(desc(paymentCheckouts.createdAt))
        .limit(MAX_CHECKOUTS_PER_RUN);

      for (const row of open) {
        const age = now.getTime() - row.createdAt.getTime();
        if (
          !this.mayAsk(`checkout:${row.id}`, age < HOUR_MS ? 0 : OLD_CHECKOUT_ASK_EVERY_MS, now)
        ) {
          continue;
        }
        outcome.checkouts += 1;
        try {
          const event = await status(row.id, row.providerReference as string);
          if (event && (await subscriptionService.applyEvent(plugin, event, now)) === 'applied') {
            outcome.applied += 1;
          }
        } catch (error) {
          failures += 1;
          logger.warn(
            `Payments: could not look at an attempt (${error instanceof Error ? error.message : 'failed'}).`,
          );
        }
      }
    }
    this.lastRun = { ...outcome, at: now, failures };
    if (outcome.applied > 0) {
      // Each is a notice that never arrived: worth the administrators knowing (the health panel counts them).
      auditService.record({
        category: 'payment',
        action: 'payment.reconciled',
        meta: { found: outcome.applied },
      });
    }
    return outcome;
  }
}

export const paymentReconciliationService = new PaymentReconciliationService();
