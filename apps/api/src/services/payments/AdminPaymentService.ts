import type {
  AdminPaymentEvent,
  AdminPaymentEventListQuery,
  AdminPaymentEventPage,
  AdminPaymentSummary,
  AdminPaymentUser,
  AdminSubscription,
  AdminSubscriptionListQuery,
  AdminSubscriptionPage,
  AdminUserSubscription,
} from '@keres/shared';
import { PAYMENT_WARNING_DAYS } from '@keres/shared/metadata/Payments';
import { and, asc, count, desc, eq, gte, inArray, lte, or, sql, sum, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { paymentEvents, paymentSubscriptions, tiers, users } from '../../db/schema';
import { insensitiveLike } from '../../db/sqlOperators';
import { effectiveDefaultTierId } from '../defaultTier';
import { registrationSettingsService } from '../RegistrationSettingsService';
import { getPaymentPlugin } from './PaymentPluginRegistry';

const DAY_MS = 24 * 60 * 60 * 1000;

type UserRow = { id: string; username: string; tag: string; isDeleted: boolean };

const toUser = (row: UserRow | undefined): AdminPaymentUser | null =>
  row ? { id: row.id, username: row.username, tag: row.tag, isDeleted: row.isDeleted } : null;

type SubscriptionJoin = {
  subscription: typeof paymentSubscriptions.$inferSelect;
  user: UserRow | null;
  tierName: string | null;
};

const toAdminSubscription = ({
  subscription,
  user,
  tierName,
}: SubscriptionJoin): AdminSubscription => ({
  user: toUser(user ?? undefined),
  tierId: subscription.tierId,
  tierName: tierName ?? 'Plan',
  interval: subscription.interval,
  status: subscription.status,
  paidUntil: subscription.paidUntil.toISOString(),
  lastPaymentAt: subscription.lastPaymentAt?.toISOString() ?? null,
  amountCents: subscription.amountCents,
  currency: subscription.currency,
  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  providerId: subscription.providerId,
  providerReference: subscription.providerReference,
  createdAt: subscription.createdAt.toISOString(),
});

async function usersById(ids: (string | null)[]): Promise<Map<string, UserRow>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, username: users.username, tag: users.tag, isDeleted: users.isDeleted })
    .from(users)
    .where(inArray(users.id, unique));
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * What the administrators see of payments: the situation (who is paid up, who is late, who is leaving) and
 * the key values (the amounts, the provider's own references to look a payment up there). Read-only, and
 * there is nothing else to show: no way to pay is kept anywhere.
 */
export class AdminPaymentService {
  async summary(now = new Date()): Promise<AdminPaymentSummary> {
    const plugin = getPaymentPlugin();
    const { currency } = await registrationSettingsService.getOrCreate();
    const defaultTierId = await effectiveDefaultTierId();

    const perStatus = await db
      .select({ status: paymentSubscriptions.status, total: count() })
      .from(paymentSubscriptions)
      .groupBy(paymentSubscriptions.status);
    const subscriptions = { active: 0, due: 0, canceled: 0 };
    for (const row of perStatus) subscriptions[row.status] = row.total;

    const soon = new Date(now.getTime() + PAYMENT_WARNING_DAYS * DAY_MS);
    const [{ endingSoon }] = await db
      .select({ endingSoon: count() })
      .from(paymentSubscriptions)
      .where(
        and(eq(paymentSubscriptions.status, 'active'), lte(paymentSubscriptions.paidUntil, soon)),
      );

    const since = new Date(now.getTime() - 30 * DAY_MS);
    const [received] = await db
      .select({ payments: count(), amount: sum(paymentEvents.amountCents) })
      .from(paymentEvents)
      .where(
        and(
          eq(paymentEvents.kind, 'payment_succeeded'),
          gte(paymentEvents.createdAt, since),
          sql`${paymentEvents.userId} is not null`,
        ),
      );
    const [failed] = await db
      .select({ failures: count() })
      .from(paymentEvents)
      .where(and(eq(paymentEvents.kind, 'payment_failed'), gte(paymentEvents.createdAt, since)));

    const active = await db
      .select({ interval: paymentSubscriptions.interval, amount: paymentSubscriptions.amountCents })
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.status, 'active'));
    const monthlyRecurringCents = active.reduce(
      (total, row) =>
        total + (row.interval === 'yearly' ? Math.round(row.amount / 12) : row.amount),
      0,
    );

    const sellsOrGives =
      plugin !== null || subscriptions.active + subscriptions.due + subscriptions.canceled > 0;
    return {
      enabled: plugin !== null,
      provider: plugin ? { id: plugin.id, displayName: plugin.displayName } : null,
      currency,
      subscriptions,
      endingSoon,
      last30Days: {
        payments: received?.payments ?? 0,
        failures: failed?.failures ?? 0,
        amountCents: Number(received?.amount ?? 0),
      },
      monthlyRecurringCents,
      noDefaultTier: sellsOrGives && !defaultTierId,
    };
  }

  async listSubscriptions(query: AdminSubscriptionListQuery): Promise<AdminSubscriptionPage> {
    const conditions: SQL[] = [];
    if (query.status !== 'all') conditions.push(eq(paymentSubscriptions.status, query.status));
    if (query.search) {
      const like = `%${query.search}%`;
      conditions.push(
        or(
          insensitiveLike(users.username, like),
          insensitiveLike(users.tag, like),
          insensitiveLike(paymentSubscriptions.providerReference, like),
        ) as SQL,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const direction = query.order === 'asc' ? asc : desc;
    const orderBy =
      query.sort === 'user'
        ? direction(users.username)
        : direction(
            query.sort === 'createdAt'
              ? paymentSubscriptions.createdAt
              : paymentSubscriptions.paidUntil,
          );

    const joined = db
      .select({ subscription: paymentSubscriptions, user: users, tierName: tiers.name })
      .from(paymentSubscriptions)
      .leftJoin(users, eq(users.id, paymentSubscriptions.userId))
      .leftJoin(tiers, eq(tiers.id, paymentSubscriptions.tierId));
    const [rows, [{ total }]] = await Promise.all([
      joined
        .where(where)
        .orderBy(orderBy, asc(paymentSubscriptions.userId))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db
        .select({ total: count() })
        .from(paymentSubscriptions)
        .leftJoin(users, eq(users.id, paymentSubscriptions.userId))
        .where(where),
    ]);

    const items = rows.map(toAdminSubscription);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** One person's subscription, and whether the plugin could stop the provider charging it - what giving them a plan needs. */
  async subscriptionOfUser(userId: string): Promise<AdminUserSubscription> {
    const [row] = await db
      .select({ subscription: paymentSubscriptions, user: users, tierName: tiers.name })
      .from(paymentSubscriptions)
      .leftJoin(users, eq(users.id, paymentSubscriptions.userId))
      .leftJoin(tiers, eq(tiers.id, paymentSubscriptions.tierId))
      .where(eq(paymentSubscriptions.userId, userId))
      .limit(1);
    const plugin = getPaymentPlugin();
    return {
      subscription: row ? toAdminSubscription(row) : null,
      canCancelAtProvider: Boolean(
        row &&
          plugin?.cancelSubscription &&
          row.subscription.providerReference &&
          row.subscription.providerId === plugin.id,
      ),
    };
  }

  async listEvents(query: AdminPaymentEventListQuery): Promise<AdminPaymentEventPage> {
    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(paymentEvents)
        .orderBy(desc(paymentEvents.createdAt), desc(paymentEvents.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      db.select({ total: count() }).from(paymentEvents),
    ]);
    const people = await usersById(rows.map((row) => row.userId));
    const items: AdminPaymentEvent[] = rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      user: row.userId ? toUser(people.get(row.userId)) : null,
      tierName: row.tierName,
      amountCents: row.amountCents,
      currency: row.currency,
      providerId: row.providerId,
      providerReference: row.providerReference,
      detail: row.detail,
      createdAt: row.createdAt.toISOString(),
    }));
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}

export const adminPaymentService = new AdminPaymentService();
