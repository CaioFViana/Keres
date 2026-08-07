import type { PartialTier, Tier, TierCreateInput } from '@keres/shared';
import { apiClient } from './apiClient';

export const TierApiService = {
  async list(includeDeleted = false): Promise<Tier[]> {
    const { data } = await apiClient.get('/admin/api/tiers', { params: { includeDeleted } });
    return data;
  },
  async get(id: string): Promise<Tier> {
    const { data } = await apiClient.get(`/admin/api/tiers/${id}`);
    return data;
  },
  async create(input: TierCreateInput): Promise<Tier> {
    const { data } = await apiClient.post('/admin/api/tiers', input);
    return data;
  },
  async update(id: string, patch: PartialTier): Promise<Tier> {
    const { data } = await apiClient.put(`/admin/api/tiers/${id}`, patch);
    return data;
  },
  async softDelete(id: string): Promise<Tier> {
    const { data } = await apiClient.delete(`/admin/api/tiers/${id}`);
    return data;
  },
};
