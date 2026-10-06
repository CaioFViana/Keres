import type { AdminPaymentHealth, AdminPaymentWarning } from '@keres/shared';
import { and, count, eq, gt, gte, isNotNull, like, lte, max } from 'drizzle-orm';
import { db } from '../../db';
import {
  auditEvents,
  paymentCheckouts,
  paymentEvents,
  paymentSubscriptions,
} from '../../db/schema';
import { connectorConfig } from './connector/config';
import { getPaymentConnector } from './PaymentConnectorRegistry';
import { paymentReconciliationService } from './PaymentReconciliationService';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Subscriptions renew at least yearly; with some paid up, a provider silent for this long is worth a look. */
const SILENT_AFTER_DAYS = 35;
const MANY_STALE_ATTEMPTS = 10;

/**
 * Whether the money side is working, for the administrators: the connector, the provider's notices, the safety net,
 * and what is stuck. Everything but the safety net's last run is read from what is stored, so it is the same
 * after a restart; the last run is kept in memory ("since this server started").
 */
export class PaymentHealthService {
  async snapshot(now = new Date()): Promise<AdminPaymentHealth> {
    const plugin = getPaymentConnector();
    const week = new Date(now.getTime() - 7 * DAY_MS);

    const [{ last }] = await db
      .select({ last: max(paymentEvents.createdAt) })
      .from(paymentEvents)
      .where(isNotNull(paymentEvents.providerEventId));

    const [{ renewing }] = await db
      .select({ renewing: count() })
      .from(paymentSubscriptions)
      .where(
        and(
          eq(paymentSubscriptions.status, 'active'),
          eq(paymentSubscriptions.cancelAtPeriodEnd, false),
          lte(paymentSubscriptions.paidUntil, now),
        ),
      );
    const [{ due }] = await db
      .select({ due: count() })
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.status, 'due'));
    const [{ paidUp }] = await db
      .select({ paidUp: count() })
      .from(paymentSubscriptions)
      .where(
        and(eq(paymentSubscriptions.status, 'active'), gt(paymentSubscriptions.paidUntil, now)),
      );

    const [{ stale }] = await db
      .select({ stale: count() })
      .from(paymentCheckouts)
      .where(
        and(
          eq(paymentCheckouts.status, 'pending'),
          isNotNull(paymentCheckouts.providerReference),
          lte(paymentCheckouts.createdAt, new Date(now.getTime() - HOUR_MS)),
        ),
      );
    const [{ unmatched }] = await db
      .select({ unmatched: count() })
      .from(paymentEvents)
      .where(
        and(like(paymentEvents.providerEventId, 'unmatched:%'), gte(paymentEvents.createdAt, week)),
      );

    const reconciled = await db
      .select({ meta: auditEvents.meta })
      .from(auditEvents)
      .where(and(eq(auditEvents.action, 'payment.reconciled'), gte(auditEvents.createdAt, week)));
    const foundByReconciliation7d = reconciled.reduce((total, row) => {
      const found = (row.meta as { found?: unknown } | null)?.found;
      return total + (typeof found === 'number' ? found : 0);
    }, 0);

    const run = paymentReconciliationService.lastRun;
    const warnings: AdminPaymentWarning[] = [];
    if (!plugin && connectorConfig()) warnings.push('no-connector');
    if (
      plugin &&
      paidUp > 0 &&
      (!last || now.getTime() - last.getTime() > SILENT_AFTER_DAYS * DAY_MS)
    ) {
      warnings.push('no-notice');
    }
    if (run && run.failures > 0) warnings.push('reconcile-failing');
    if (foundByReconciliation7d > 0) warnings.push('reconcile-found');
    if (due > 0) warnings.push('overdue');
    if (unmatched > 0) warnings.push('unmatched');
    if (stale >= MANY_STALE_ATTEMPTS) warnings.push('stale-attempts');

    return {
      connector: {
        connected: plugin !== null,
        id: plugin?.id ?? null,
        capabilities: [...(plugin?.capabilities ?? [])],
      },
      lastNoticeAt: last ? last.toISOString() : null,
      reconciliation: run
        ? {
            lastRunAt: run.at.toISOString(),
            subscriptionsAsked: run.subscriptions,
            attemptsAsked: run.checkouts,
            found: run.applied,
            failures: run.failures,
          }
        : null,
      foundByReconciliation7d,
      overdue: { renewing, due },
      staleAttempts: stale,
      unmatched7d: unmatched,
      warnings,
    };
  }
}

export const paymentHealthService = new PaymentHealthService();
