import type { ServerSelect } from '../db/schema';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

/**
 * Calls to the `/story-permissions` routes of the server a story is linked to - collaborator
 * management, never stored locally (the server is what knows who has access). Used today only by the
 * Story Settings screen, for the "unlink from server" gate (owner only, only with no collaborators) and
 * the list that makes it possible.
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

  /** Grants (or updates, if one already exists) a collaborator's permission on a story. Caller must re-fetch `getCollaborators` afterward - the upsert response doesn't carry the joined `user` info. */
  async grantCollaborator(
    server: ServerSelect,
    storyId: string,
    targetUserId: string,
    permissionType: 'reader' | 'writer',
  ): Promise<void> {
    await clientFor(server).post('/story-permissions/', { storyId, targetUserId, permissionType });
  },

  /** Same upsert endpoint, named explicitly for the edit-permission UI. */
  async updateCollaboratorPermission(
    server: ServerSelect,
    storyId: string,
    targetUserId: string,
    permissionType: 'reader' | 'writer',
  ): Promise<void> {
    await this.grantCollaborator(server, storyId, targetUserId, permissionType);
  },
};
