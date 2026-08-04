import type { AdminCreateUser, AdminUpdateUser, AdminUserInfo } from '@keres/shared';
import { apiClient } from './apiClient';

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
    const { data } = await apiClient.get('/admin/api/users', { params: filters });
    return data;
  },
  async get(id: string): Promise<AdminUserInfo> {
    const { data } = await apiClient.get(`/admin/api/users/${id}`);
    return data;
  },
  async create(input: AdminCreateUser): Promise<AdminUserInfo> {
    const { data } = await apiClient.post('/admin/api/users', input);
    return data;
  },
  async update(id: string, patch: AdminUpdateUser): Promise<AdminUserInfo> {
    const { data } = await apiClient.put(`/admin/api/users/${id}`, patch);
    return data;
  },
  async softDelete(id: string): Promise<AdminUserInfo> {
    const { data } = await apiClient.delete(`/admin/api/users/${id}`);
    return data;
  },
  async restore(id: string): Promise<AdminUserInfo> {
    const { data } = await apiClient.post(`/admin/api/users/${id}/restore`);
    return data;
  },
};
