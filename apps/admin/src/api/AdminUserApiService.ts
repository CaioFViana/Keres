import type { AdminCreateUser, AdminUpdateUser, AdminUserInfo } from '@keres/shared';
import { apiClient, assertSafePathSegment } from './apiClient';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserListFilters {
  search?: string;
  isAdmin?: boolean;
  isDeleted?: boolean;
  tierId?: string;
  page?: number;
  pageSize?: number;
}

export const AdminUserApiService = {
  async list(filters: UserListFilters): Promise<Paginated<AdminUserInfo>> {
    const { data } = await apiClient.get('/admin/users', { params: filters });
    return data;
  },
  async get(id: string): Promise<AdminUserInfo> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.get(`/admin/users/${safeId}`);
    return data;
  },
  async create(input: AdminCreateUser): Promise<AdminUserInfo & { recoveryCodes: string[] }> {
    const { data } = await apiClient.post('/admin/users', input);
    return data;
  },
  async update(id: string, patch: AdminUpdateUser): Promise<AdminUserInfo> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.put(`/admin/users/${safeId}`, patch);
    return data;
  },
  async softDelete(id: string): Promise<AdminUserInfo> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.delete(`/admin/users/${safeId}`);
    return data;
  },
  async restore(id: string): Promise<AdminUserInfo> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.post(`/admin/users/${safeId}/restore`);
    return data;
  },
  async regenerateRecoveryCodes(id: string): Promise<{ recoveryCodes: string[] }> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.post(`/admin/users/${safeId}/regenerate-recovery-codes`);
    return data;
  },
};
