import type { MessageLimits } from '@keres/shared';
import { ADMIN_MESSAGES_PER_DAY } from '@keres/shared/metadata/MessageLimits';
import { and, count, eq, gte, lt } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../db';
import { messageLog } from '../db/schema';
import { TierLimitExceededError, tierEnforcementService } from './TierEnforcementService';

export type MessageQuotaKind = 'direct' | 'admin';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many messages a user may send in a day.
 *
 * Messages to other users count against the plan (`tiers.maxMessagesPerDay`, `null` = unlimited);
 * messages to the administrators have one fixed ceiling for everybody, so the contact channel cannot
 * be flooded whatever the plan. Both are rolling 24-hour windows over `message_log`, which deleting a
 * message does not touch - the same arrangement, and the same accepted race, as the publications per
 * day in `TierEnforcementService`.
 */
export class MessageQuotaService {
  private async used(userId: string, kind: MessageQuotaKind, now: Date): Promise<number> {
    const since = new Date(now.getTime() - DAY_MS);
    const [{ total }] = await db
      .select({ total: count() })
      .from(messageLog)
      .where(
        and(
          eq(messageLog.userId, userId),
          eq(messageLog.kind, kind),
          gte(messageLog.createdAt, since),
        ),
      );
    return total;
  }

  private async directLimit(userId: string): Promise<number | null> {
    const tier = await tierEnforcementService.getEffectiveTier(userId);
    return tier?.maxMessagesPerDay ?? null;
  }

  async assertCanSend(userId: string, kind: MessageQuotaKind, now = new Date()): Promise<void> {
    const limit = kind === 'admin' ? ADMIN_MESSAGES_PER_DAY : await this.directLimit(userId);
    if (limit === null) {
      return;
    }
    if ((await this.used(userId, kind, now)) >= limit) {
      throw new TierLimitExceededError(
        kind === 'admin'
          ? `You can send ${limit} messages a day to the administrators. Try again later.`
          : `Message limit reached for your plan (${limit} a day). Try again later.`,
      );
    }
  }

  /** Notes a sent message, and drops entries too old to matter. Runs in the sending transaction. */
  async record(
    runner: Pick<typeof db, 'insert' | 'delete'>,
    userId: string,
    kind: MessageQuotaKind,
    now = new Date(),
  ): Promise<void> {
    await runner.insert(messageLog).values({ id: ulid(), userId, kind, createdAt: now });
    await runner
      .delete(messageLog)
      .where(lt(messageLog.createdAt, new Date(now.getTime() - 2 * DAY_MS)));
  }

  async getLimits(userId: string, now = new Date()): Promise<MessageLimits> {
    const [directLimit, directUsed, adminUsed] = await Promise.all([
      this.directLimit(userId),
      this.used(userId, 'direct', now),
      this.used(userId, 'admin', now),
    ]);
    return {
      direct: { limit: directLimit, used: directUsed },
      admin: { limit: ADMIN_MESSAGES_PER_DAY, used: adminUsed },
    };
  }
}

export const messageQuotaService = new MessageQuotaService();
