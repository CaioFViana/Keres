import {
  PAYMENT_HISTORY_KINDS,
  type PaymentHistoryPage,
  type PaymentHistoryQuery,
} from '@keres/shared';
import { and, desc, eq, inArray, lt, not, or, isNull, like } from 'drizzle-orm';
import { db } from '../../db';
import { paymentEvents } from '../../db/schema';
import { REFUSED_DETAIL_PREFIX } from './paymentLedger';

/**
 * A person's own payment history: the ledger lines about them that are payments (paid, failed, given), newest
 * first. It is what the app keeps a copy of, so it carries only what a person needs to recognise a payment - when,
 * which plan, how much - and this server's own id for it. The provider's reference (a subscription id, a store
 * purchase token) never leaves the server.
 */
export class PaymentHistoryService {
  async list(userId: string, query: PaymentHistoryQuery): Promise<PaymentHistoryPage> {
    const conditions = [
      eq(paymentEvents.userId, userId),
      inArray(paymentEvents.kind, [...PAYMENT_HISTORY_KINDS]),
      // A payment the server turned down (a store token of somebody else) is not one the person made.
      or(
        isNull(paymentEvents.detail),
        not(like(paymentEvents.detail, `${REFUSED_DETAIL_PREFIX}%`)),
      ),
    ];
    // Ids are ULIDs: they sort by time, so the id the last page ended at is a stable place to continue from.
    if (query.before) conditions.push(lt(paymentEvents.id, query.before));

    const rows = await db
      .select()
      .from(paymentEvents)
      .where(and(...conditions))
      .orderBy(desc(paymentEvents.id))
      .limit(query.limit + 1);

    const page = rows.slice(0, query.limit);
    return {
      items: page.map((row) => ({
        id: row.id,
        kind: row.kind as PaymentHistoryPage['items'][number]['kind'],
        tierName: row.tierName,
        amountCents: row.amountCents,
        currency: row.currency,
        createdAt: row.createdAt.toISOString(),
      })),
      nextBefore: rows.length > query.limit ? (page[page.length - 1]?.id ?? null) : null,
    };
  }
}

export const paymentHistoryService = new PaymentHistoryService();
