import { apiClient, assertSafePathSegment } from './apiClient';

export interface AdminStoryItem {
  id: string;
  title: string;
  isNsfw: boolean;
  isDeleted: boolean;
  updatedAt: string;
  ownerUserId: string;
  ownerUsername: string;
  ownerTag: string;
  ownerDeleted: boolean;
}

export interface AdminStoryCollaborator {
  permissionId: string;
  userId: string;
  username: string;
  tag: string;
  permissionType: string;
}

export interface StoryListFilters {
  search?: string;
  nsfw?: boolean;
  page?: number;
  pageSize?: number;
}

export const AdminStoryApiService = {
  async list(filters: StoryListFilters): Promise<{
    items: AdminStoryItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { data } = await apiClient.get('/admin/stories', { params: filters });
    return data;
  },
  async setNsfw(id: string, isNsfw: boolean): Promise<AdminStoryItem> {
    const safeId = assertSafePathSegment(id);
    const { data } = await apiClient.patch(`/admin/stories/${safeId}`, { isNsfw });
    return data;
  },
  async collaborators(storyId: string): Promise<AdminStoryCollaborator[]> {
    const safeId = assertSafePathSegment(storyId);
    const { data } = await apiClient.get(`/admin/stories/${safeId}/collaborators`);
    return data;
  },
  async removeCollaborator(storyId: string, userId: string): Promise<{ message: string }> {
    const safeStory = assertSafePathSegment(storyId);
    const safeUser = assertSafePathSegment(userId);
    const { data } = await apiClient.delete(
      `/admin/stories/${safeStory}/collaborators/${safeUser}`,
    );
    return data;
  },
};
