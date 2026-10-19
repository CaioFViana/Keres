import type { AuditEventListQuery, AuditEventPage, AuditSummary } from '@keres/shared';
import { apiClient } from './apiClient';

/** Every filter is optional: the server fills in what is left out (everything, newest first, 50 a page). */
export type ActivityFilters = Partial<
  Omit<AuditEventListQuery, 'from' | 'to'> & { from: string; to: string }
>;

export const ActivityApiService = {
  async list(filters: ActivityFilters): Promise<AuditEventPage> {
    const { data } = await apiClient.get('/admin/activity', { params: filters });
    return data;
  },
  /** What happened in the last `hours`, and how the server is doing. */
  async summary(hours: number): Promise<AuditSummary> {
    const { data } = await apiClient.get('/admin/activity/summary', { params: { hours } });
    return data;
  },
  /** The filtered record as a CSV file (the server names it; this only hands over the bytes). */
  async exportCsv(filters: ActivityFilters): Promise<Blob> {
    const { data } = await apiClient.get('/admin/activity/export', {
      params: filters,
      responseType: 'blob',
    });
    return data;
  },
};
