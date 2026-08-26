import type { PartialTier, Tier, TierCreateInput } from '@keres/shared';
import { apiClient, assertSafePathSegment } from './apiClient';

export const TierApiService = {
  async list(includeDeleted = false): Promise<Tier[]> {
    const { data } = await apiClient.get('/admin/tiers', { params: { includeDeleted } });
    return data;
  },
  async get(id: string): Promise<Tier> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.get(`/admin/tiers/${safeId}`);
    return data;
  },
  async create(input: TierCreateInput): Promise<Tier> {
    const { data } = await apiClient.post('/admin/tiers', input);
    return data;
  },
  async update(id: string, patch: PartialTier): Promise<Tier> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.put(`/admin/tiers/${safeId}`, patch);
    return data;
  },
  async softDelete(id: string): Promise<Tier> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.delete(`/admin/tiers/${safeId}`);
    return data;
  },
};
