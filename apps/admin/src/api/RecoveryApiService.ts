import { apiClient, assertSafePathSegment } from './apiClient';
import type { Paginated } from './AdminUserApiService';

export interface DeletedItem {
  entityType: string;
  id: string;
  storyId: string | null;
  storyTitle: string | null;
  deletedAt: string | null;
  version: number;
  /** Enriched display name (simple field or shallow composite); null when still unknown. */
  name: string | null;
}

export interface OperationLogEntry {
  id: string;
  storyId: string;
  storyTitle: string | null;
  userId: string;
  username: string | null;
  operationVersion: number;
  operationType: 'create' | 'update' | 'delete' | 'reorder';
  entityType: string;
  entityId: string;
  entityName: string | null;
  payload: Record<string, unknown>;
  entityVersion: number | null;
  createdAt: string;
}

export interface OperationLogFilters {
  storyId?: string;
  entityType?: string;
  userId?: string;
  operationType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface DeletedItemsFilters {
  entityType?: string;
  storyId?: string;
  search?: string;
}

export const RecoveryApiService = {
  async listDeleted(filters: DeletedItemsFilters): Promise<DeletedItem[]> {
    const { data } = await apiClient.get('/admin/recovery/deleted', { params: filters });
    return data;
  },
  async restore(entityType: string, id: string): Promise<unknown> {
    const safeType = assertSafePathSegment(entityType, 'entityType');
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.post(`/admin/recovery/${safeType}/${safeId}/restore`);
    return data;
  },
  async browseOperationLog(filters: OperationLogFilters): Promise<Paginated<OperationLogEntry>> {
    const { data } = await apiClient.get('/admin/recovery/operation-log', { params: filters });
    return data;
  },
};
