import type { PaymentHistoryItem } from '@keres/shared';
import { desc, eq } from 'drizzle-orm';
import type { AppDrizzleClient } from '../db';
import type { ServerPaymentSelect, ServerSelect } from '../db/schema';
import { serverPayments } from '../db/schema';
import { entityEventEmitter } from '../utils/EventEmitter';
import { isOfflineError } from './apiClient';
import { paymentApi } from './PaymentApiService';

export const PAYMENT_HISTORY_CHANGED = 'payment_history_changed';

/** A page is what the server will give at most; this many pages bound what one sync pulls. */
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

/** What a sync did: brought the server's answer, or left the saved copy alone (and why). */
export type PaymentHistorySync = 'synced' | 'offline' | 'unsupported';

export const createPaymentHistoryService = (db: AppDrizzleClient) => new PaymentHistoryService(db);

/**
 * The local copy of a person's payment history on each server - a cache of server state like the story
 * invitations: readable offline as last seen, replaced per server on every sync, never written by the device.
 * The server is the only source, so there is nothing to merge: the copy is the server's last answer.
 * Emits `payment_history_changed` (with the server id) whenever a copy is replaced.
 */
export class PaymentHistoryService {
  constructor(private readonly db: AppDrizzleClient) {}

  /** What is saved for a server, newest first. */
  async getForServer(serverId: string): Promise<ServerPaymentSelect[]> {
    return this.db
      .select()
      .from(serverPayments)
      .where(eq(serverPayments.serverId, serverId))
      .orderBy(desc(serverPayments.createdAt), desc(serverPayments.id))
      .all();
  }

  /**
   * Replaces the server's saved history with what the server says now. A server that cannot be reached, or
   * that predates the route, keeps its last copy: an old history is better than an empty one.
   */
  async syncWithServer(server: ServerSelect): Promise<PaymentHistorySync> {
    const fetched: PaymentHistoryItem[] = [];
    try {
      let before: string | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const answer = await paymentApi.getHistory(server, { limit: PAGE_SIZE, before });
        fetched.push(...answer.items);
        if (!answer.nextBefore) break;
        before = answer.nextBefore;
      }
    } catch (error) {
      if (isOfflineError(error)) return 'offline';
      if ((error as { response?: { status?: number } })?.response?.status === 404) {
        return 'unsupported';
      }
      throw error;
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(serverPayments).where(eq(serverPayments.serverId, server.id)).run();
      for (const item of fetched) {
        await tx
          .insert(serverPayments)
          .values({
            id: item.id,
            serverId: server.id,
            kind: item.kind,
            tierName: item.tierName,
            amountCents: item.amountCents,
            currency: item.currency,
            createdAt: new Date(item.createdAt),
          })
          .run();
      }
    });
    entityEventEmitter.emit(PAYMENT_HISTORY_CHANGED, server.id);
    return 'synced';
  }
}
