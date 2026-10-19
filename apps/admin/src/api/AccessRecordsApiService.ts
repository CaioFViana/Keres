import type { AccessRecordPage } from '@keres/shared';
import { apiClient } from './apiClient';

/** The filters of the access records. Every one is optional: the server fills in what is left out. */
export interface AccessRecordFilters {
  userId?: string;
  username?: string;
  ip?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export const AccessRecordsApiService = {
  /** One page of the access records, newest first; `nextCursor` asks for the next one. */
  async list(filters: AccessRecordFilters): Promise<AccessRecordPage> {
    const { data } = await apiClient.get('/admin/access-records', { params: filters });
    return data;
  },
  /**
   * The filtered records as a CSV file, with whether the server cut it short (the header says so). This only
   * hands over the bytes; the panel names the file.
   */
  async exportCsv(filters: AccessRecordFilters): Promise<{ blob: Blob; truncated: boolean }> {
    const response = await apiClient.get('/admin/access-records/export', {
      params: filters,
      responseType: 'blob',
    });
    return {
      blob: response.data,
      truncated: response.headers['x-export-truncated'] === 'true',
    };
  },
};
