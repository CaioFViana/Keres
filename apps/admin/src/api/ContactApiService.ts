import type { ContactMessage } from '@keres/shared';
import { apiClient, assertSafePathSegment } from './apiClient';

export const ContactApiService = {
  async list(): Promise<ContactMessage[]> {
    const { data } = await apiClient.get('/admin/contact');
    return data;
  },
  /** Reading marks the message read on the server; there is no separate action for it. */
  async get(id: string): Promise<ContactMessage> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.get(`/admin/contact/${safeId}`);
    return data;
  },
  async remove(id: string): Promise<{ id: string }> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.delete(`/admin/contact/${safeId}`);
    return data;
  },
};
