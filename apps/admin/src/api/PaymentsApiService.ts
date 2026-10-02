import type {
  AdminPaymentEventListQuery,
  AdminPaymentEventPage,
  AdminPaymentSummary,
  AdminSubscriptionListQuery,
  AdminSubscriptionPage,
} from '@keres/shared';
import { apiClient } from './apiClient';

/** Every filter is optional: the server fills in what is left out (all of them, nearest end of period first). */
export type SubscriptionFilters = Partial<AdminSubscriptionListQuery>;

/** Read only: payments are made and changed between the person and the provider, never from here. */
export const PaymentsApiService = {
  async summary(): Promise<AdminPaymentSummary> {
    const { data } = await apiClient.get('/admin/payments/summary');
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
};
