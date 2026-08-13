import { apiClient } from './apiClient';
import type { Paginated } from './AdminUserApiService';

export interface ApiLogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  meta: Record<string, unknown> | null;
  userId: string | null;
  storyId: string | null;
  createdAt: string;
}

export interface ApiLogFilters {
  level?: 'info' | 'warn' | 'error';
  storyId?: string;
  userId?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const LogsApiService = {
  async list(filters: ApiLogFilters): Promise<Paginated<ApiLogEntry>> {
    const { data } = await apiClient.get('/admin/api/logs', { params: filters });
    return data;
  },
};
