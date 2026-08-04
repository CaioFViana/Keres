import { apiClient } from './apiClient';
import type { Paginated } from './AdminUserApiService';

export interface DeletedItem {
  entityType: string;
  id: string;
  storyId: string | null;
  deletedAt: string | null;
  version: number;
}

export interface OperationLogEntry {
  id: string;
  storyId: string;
  userId: string;
  operationVersion: number;
  operationType: 'create' | 'update' | 'delete' | 'reorder';
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  entityVersion: number | null;
  createdAt: string;
}

export interface OperationLogFilters {
  storyId?: string;
  entityType?: string;
  userId?: string;
  operationType?: string;
  page?: number;
  pageSize?: number;
}

export const RecoveryApiService = {
  async listDeleted(filters: { entityType?: string; storyId?: string }): Promise<DeletedItem[]> {
    const { data } = await apiClient.get('/admin/api/recovery/deleted', { params: filters });
    return data;
  },
  async restore(entityType: string, id: string): Promise<unknown> {
    const { data } = await apiClient.post(`/admin/api/recovery/${entityType}/${id}/restore`);
    return data;
  },
  async browseOperationLog(filters: OperationLogFilters): Promise<Paginated<OperationLogEntry>> {
    const { data } = await apiClient.get('/admin/api/recovery/operation-log', { params: filters });
    return data;
  },
};
