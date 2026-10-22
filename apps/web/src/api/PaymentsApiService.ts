import type {
  AdminGiftCreate,
  AdminPaymentHealth,
  AdminPaymentEventListQuery,
  AdminPaymentEventPage,
  AdminPaymentSummary,
  AdminSubscriptionListQuery,
  AdminSubscriptionPage,
  AdminUserSubscription,
} from '@keres/shared';
import { apiClient, assertSafePathSegment } from './apiClient';

/** Every filter is optional: the server fills in what is left out (all of them, nearest end of period first). */
export type SubscriptionFilters = Partial<AdminSubscriptionListQuery>;

/**
 * What the administrators see of payments. Payments themselves are made and changed between the person and the
 * provider, never from here; the one thing done from here is giving a person a plan for a while.
 */
export const PaymentsApiService = {
  async summary(): Promise<AdminPaymentSummary> {
    const { data } = await apiClient.get('/admin/payments/summary');
    return data;
  },
  /** Whether the money side is working: the connector, the notices, the safety net, what is stuck. */
  async health(): Promise<AdminPaymentHealth> {
    const { data } = await apiClient.get('/admin/payments/health');
    return data;
  },
  async subscriptions(filters: SubscriptionFilters): Promise<AdminSubscriptionPage> {
    const { data } = await apiClient.get('/admin/payments/subscriptions', { params: filters });
    return data;
  },
  async events(query: Partial<AdminPaymentEventListQuery>): Promise<AdminPaymentEventPage> {
    const { data } = await apiClient.get('/admin/payments/events', { params: query });
    return data;
  },
  /** One person's subscription, and whether the provider could be stopped from here. */
  async userSubscription(userId: string): Promise<AdminUserSubscription> {
    const { data } = await apiClient.get(
      `/admin/payments/users/${assertSafePathSegment(userId)}/subscription`,
    );
    return data;
  },
  /** Gives the person a plan for `months` months: a payment of zero. */
  async giveGift(userId: string, input: Partial<AdminGiftCreate>): Promise<AdminUserSubscription> {
    const { data } = await apiClient.post(
      `/admin/payments/users/${assertSafePathSegment(userId)}/gift`,
      input,
    );
    return data;
  },
};
