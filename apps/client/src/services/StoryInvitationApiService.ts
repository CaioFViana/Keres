import type { StoryInvitation } from '@keres/shared';
import type { ServerSelect } from '../db/schemas/servers';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

type Role = 'reader' | 'writer';

/**
 * The `/friend/story-invitations` routes of one server. Server-bound like `FriendshipApiService`:
 * invitations live on the server where the story does, and the app may know several servers.
 */
function clientFor(server: ServerSelect) {
  const client = createKeresAxiosInstance({ baseURL: server.url });
  client.setTokenProvider(authTokenManager);
  client.setActiveServer(server);
  return client;
}

export const storyInvitationApi = {
  /** Every open invitation the user sent or received on this server. */
  async list(server: ServerSelect): Promise<StoryInvitation[]> {
    return (await clientFor(server).get<StoryInvitation[]>('/friend/story-invitations/')).data;
  },

  /** The story's open invitations; owner only (403 otherwise). */
  async listForStory(server: ServerSelect, storyId: string): Promise<StoryInvitation[]> {
    return (
      await clientFor(server).get<StoryInvitation[]>(`/friend/story-invitations/story/${storyId}`)
    ).data;
  },

  /** Invites a friend, or changes the role offered to somebody already invited. */
  async invite(
    server: ServerSelect,
    storyId: string,
    targetUserId: string,
    permissionType: Role,
  ): Promise<StoryInvitation> {
    return (
      await clientFor(server).post<StoryInvitation>('/friend/story-invitations/', {
        storyId,
        targetUserId,
        permissionType,
      })
    ).data;
  },

  async accept(server: ServerSelect, invitationId: string): Promise<{ storyId: string }> {
    return (
      await clientFor(server).put<{ storyId: string }>(
        `/friend/story-invitations/${invitationId}/accept`,
      )
    ).data;
  },

  /** Declines (invitee) or withdraws (owner) an invitation. */
  async remove(server: ServerSelect, invitationId: string): Promise<void> {
    await clientFor(server).delete(`/friend/story-invitations/${invitationId}`);
  },
};
