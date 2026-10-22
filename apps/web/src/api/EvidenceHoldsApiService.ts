import type { EvidenceHoldSummary, EvidenceHoldTarget } from '@keres/shared/metadata/EvidenceHolds';
import { apiClient, assertSafePathSegment } from './apiClient';

/** One hold with the copy of the item as it was when reported. The copy is read only here, never listed. */
export interface EvidenceHoldDetail extends EvidenceHoldSummary {
  snapshot: unknown;
}

export interface EvidenceHoldListFilters {
  limit?: number;
  includeExpired: boolean;
}

export interface EvidenceHoldCreateInput {
  targetKind: EvidenceHoldTarget;
  targetId: string;
  reportMessageId?: string;
  note?: string;
}

export const EvidenceHoldsApiService = {
  /** The holds, newest first. Expired ones come back only when asked for. */
  async list(filters: EvidenceHoldListFilters): Promise<{ items: EvidenceHoldSummary[] }> {
    const { data } = await apiClient.get('/admin/evidence-holds', { params: filters });
    return data;
  },
  async get(id: string): Promise<EvidenceHoldDetail> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.get(`/admin/evidence-holds/${safeId}`);
    return data;
  },
  async create(input: EvidenceHoldCreateInput): Promise<EvidenceHoldSummary> {
    const { data } = await apiClient.post('/admin/evidence-holds', input);
    return data;
  },
  /** Lasts `days` from today; the server never shortens a hold. */
  async extend(id: string, days: number): Promise<EvidenceHoldSummary> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.post(`/admin/evidence-holds/${safeId}/extend`, { days });
    return data;
  },
  /** Lets the hold go before it expires: the report was unfounded. */
  async release(id: string): Promise<{ ok: boolean }> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.delete(`/admin/evidence-holds/${safeId}`);
    return data;
  },
};
