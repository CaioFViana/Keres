import type { ServerSelect } from '../db/schema';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

/**
 * Calls to the `/story-permissions` routes of the server a story is linked to - collaborator
 * management, never stored locally (the server is what knows who has access). Access is never granted
 * here: a collaborator is invited, and only their acceptance creates the permission.
 */

export interface StoryCollaborator {
  id: string;
  storyId: string;
  userId: string;
  permissionType: 'reader' | 'writer';
  user: { id: string; username: string } | null;
}

function clientFor(server: ServerSelect) {
  const client = createKeresAxiosInstance({ baseURL: server.url });
  client.setTokenProvider(authTokenManager);
  client.setActiveServer(server);
  return client;
}

export const storyPermissionApi = {
  /** It throws with `response.status === 403` when the caller is not the story's owner on the server. */
  async getCollaborators(server: ServerSelect, storyId: string): Promise<StoryCollaborator[]> {
    const response = await clientFor(server).get<StoryCollaborator[]>(
      `/story-permissions/story/${storyId}`,
    );
    return response.data;
  },

  async removeCollaborator(
    server: ServerSelect,
    storyId: string,
    targetUserId: string,
  ): Promise<void> {
    await clientFor(server).delete(`/story-permissions/story/${storyId}/user/${targetUserId}`);
  },

  /** Changes an existing collaborator's role. New collaborators are invited (`StoryInvitationApiService`). */
  async updateCollaboratorPermission(
    server: ServerSelect,
    storyId: string,
    targetUserId: string,
    permissionType: 'reader' | 'writer',
  ): Promise<void> {
    await clientFor(server).post('/story-permissions/', { storyId, targetUserId, permissionType });
  },
};
