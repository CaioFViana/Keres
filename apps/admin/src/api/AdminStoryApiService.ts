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

export interface AdminStoryMediaItem {
  id: string;
  fileName: string;
  title: string | null;
  mediaType: string;
  mimeType: string;
  sizeBytes: number;
  hash: string;
  sourceUrl: string | null;
  extraNotes: string | null;
  isFavorite: boolean;
  updatedAt: string;
}

export interface AdminStoryBoardSummary {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  summary: {
    nodeCount: number;
    edgeCount: number;
    entityPins: Array<{ entityType: string; entityId: string; label: string; note: string | null }>;
    notes: Array<{ title: string; body: string | null }>;
    edgeLabels: string[];
  };
}

export interface AdminStoryLocationMapSummary {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  summary: {
    imageCount: number;
    nodeCount: number;
    baseGalleryIds: string[];
    locationIds: string[];
    markers: Array<{ title: string; note: string | null }>;
    relationTexts: string[];
  };
}

export interface AdminStoryEntityType {
  entityType: string;
  liveCount: number;
}

export interface AdminStoryEntities {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
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
  async media(storyId: string): Promise<AdminStoryMediaItem[]> {
    const safeId = assertSafePathSegment(storyId);
    const { data } = await apiClient.get(`/admin/stories/${safeId}/media`);
    return data;
  },
  async boards(storyId: string): Promise<AdminStoryBoardSummary[]> {
    const safeId = assertSafePathSegment(storyId);
    const { data } = await apiClient.get(`/admin/stories/${safeId}/boards`);
    return data;
  },
  async locationMaps(storyId: string): Promise<AdminStoryLocationMapSummary[]> {
    const safeId = assertSafePathSegment(storyId);
    const { data } = await apiClient.get(`/admin/stories/${safeId}/location-maps`);
    return data;
  },
  async entityTypes(storyId: string): Promise<AdminStoryEntityType[]> {
    const safeId = assertSafePathSegment(storyId);
    const { data } = await apiClient.get(`/admin/stories/${safeId}/entities`);
    return data;
  },
  async entities(
    storyId: string,
    entityType: string,
    page = 1,
    pageSize = 25,
  ): Promise<AdminStoryEntities> {
    const safeId = assertSafePathSegment(storyId);
    const safeType = assertSafePathSegment(entityType, 'entityType');
    const { data } = await apiClient.get(`/admin/stories/${safeId}/entities/${safeType}`, {
      params: { page, pageSize },
    });
    return data;
  },
  /** Raw bytes of one referenced blob, for moderation previews and downloads. */
  async blob(storyId: string, hash: string): Promise<Blob> {
    const safeStory = assertSafePathSegment(storyId);
    const safeHash = assertSafePathSegment(hash, 'hash');
    const { data } = await apiClient.get(`/admin/stories/${safeStory}/blobs/${safeHash}`, {
      responseType: 'blob',
    });
    return data;
  },
};
