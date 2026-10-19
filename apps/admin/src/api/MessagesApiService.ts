import type {
  AdminMessage,
  AdminMessageDetail,
  AdminMessageListQuery,
  AdminMessagePage,
  AdminMessagePatch,
} from '@keres/shared';
import { apiClient, assertSafePathSegment } from './apiClient';

/** Every filter is optional: the server fills in what is left out (the active inbox, newest first). */
export type MessageListFilters = Partial<AdminMessageListQuery>;

export const MessagesApiService = {
  async list(filters: MessageListFilters): Promise<AdminMessagePage> {
    const { data } = await apiClient.get('/admin/messages', { params: filters });
    return data;
  },
  /** Opening marks the message read on the server, and brings the rest of the conversation along. */
  async open(id: string): Promise<AdminMessageDetail> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.get(`/admin/messages/${safeId}`);
    return data;
  },
  async patch(id: string, patch: AdminMessagePatch): Promise<AdminMessage> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.patch(`/admin/messages/${safeId}`, patch);
    return data;
  },
  /** Answers a registered user inside the platform. */
  async reply(id: string, body: string): Promise<AdminMessage> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.post(`/admin/messages/${safeId}/reply`, { body });
    return data;
  },
  async remove(id: string): Promise<{ id: string }> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.delete(`/admin/messages/${safeId}`);
    return data;
  },
  async unreadCount(): Promise<{ unread: number }> {
    const { data } = await apiClient.get('/admin/messages/unread-count');
    return data;
  },
};

/**
 * The navigation shows how many messages still need attention. Whatever changes that number
 * announces it here, so the badge follows without the page and the navigation knowing each other.
 */
export const MESSAGES_CHANGED_EVENT = 'keres-admin-messages-changed';

export function announceMessagesChanged(): void {
  window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
}
