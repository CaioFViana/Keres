import { EnrichedFriendship, Friendship } from '@keres/shared'; // Assuming Friendship is the type returned by the API
import { ServerSelect } from '../db/schemas/servers';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

export class FriendshipApiService {
  // Friendships are cross-server: the shared `apiClient` singleton only ever points at
  // one server at a time (whichever the sync loop or the currently-open story last set),
  // so reusing it here would silently send requests to the wrong server whenever more
  // than one is configured. A dedicated instance bound to the target server, following
  // the same pattern as SyncEngineService.fetchServerStoryPreviews, avoids that entirely.
  private clientFor(server: ServerSelect) {
    const client = createKeresAxiosInstance({ baseURL: server.url });
    client.setTokenProvider(authTokenManager);
    client.setActiveServer(server);
    return client;
  }

  async sendFriendRequest(server: ServerSelect, targetUserId: string): Promise<Friendship> {
    const response = await this.clientFor(server).post(`/friend/request/${targetUserId}`);
    return response.data;
  }

  async acceptFriendRequest(server: ServerSelect, targetUserId: string): Promise<Friendship> {
    const response = await this.clientFor(server).put(`/friend/accept/${targetUserId}`);
    return response.data;
  }

  async declineFriendRequest(server: ServerSelect, targetUserId: string): Promise<Friendship> {
    const response = await this.clientFor(server).delete(`/friend/decline/${targetUserId}`);
    return response.data;
  }

  async blacklistUser(server: ServerSelect, targetUserId: string): Promise<Friendship> {
    const response = await this.clientFor(server).post(`/friend/blacklist/${targetUserId}`);
    return response.data;
  }

  async unblacklistUser(server: ServerSelect, targetUserId: string): Promise<Friendship> {
    const response = await this.clientFor(server).delete(`/friend/blacklist/${targetUserId}`);
    return response.data;
  }

  async unfriendUser(server: ServerSelect, targetUserId: string): Promise<Friendship> {
    const response = await this.clientFor(server).delete(`/friend/unfriend/${targetUserId}`);
    return response.data;
  }

  async cancelSentFriendRequest(server: ServerSelect, targetUserId: string): Promise<Friendship> {
    const response = await this.clientFor(server).delete(`/friend/request/${targetUserId}`);
    return response.data;
  }

  async getFriendships(server: ServerSelect): Promise<EnrichedFriendship[]> {
    const response = await this.clientFor(server).get('/friend/');
    return response.data;
  }

  async getUserDetails(server: ServerSelect, userId: string): Promise<{
    id: string;
    username: string;
    tag: string;
    avatarColor: string | null;
    avatarIcon: string | null;
    bio: string | null;
  } | undefined> {
    try {
      const response = await this.clientFor(server).get(`/user/details/${userId}`);
      return response.data;
    } catch (error: any) { // Use 'any' to access response property
      // Handle 404 specifically, return undefined if user not found
      if (error.response && error.response.status === 404) {
        return undefined;
      }
      console.error('Error fetching user details:', error);
      throw error; // Re-throw other errors
    }
  }
}

export const friendshipApiService = new FriendshipApiService();
