import { EnrichedFriendship, Friendship } from '@keres/shared'; // Assuming Friendship is the type returned by the API
import apiClient from './apiClient';

export class FriendshipApiService {
  async sendFriendRequest(targetUserId: string): Promise<Friendship> {
    const response = await apiClient.post(`/friend/request/${targetUserId}`);
    return response.data;
  }

  async acceptFriendRequest(targetUserId: string): Promise<Friendship> {
    const response = await apiClient.put(`/friend/accept/${targetUserId}`);
    return response.data;
  }

  async declineFriendRequest(targetUserId: string): Promise<Friendship> {
    const response = await apiClient.delete(`/friend/decline/${targetUserId}`);
    return response.data;
  }

  async blacklistUser(targetUserId: string): Promise<Friendship> {
    const response = await apiClient.post(`/friend/blacklist/${targetUserId}`);
    return response.data;
  }

  async unblacklistUser(targetUserId: string): Promise<Friendship> {
    const response = await apiClient.delete(`/friend/blacklist/${targetUserId}`);
    return response.data;
  }

  async unfriendUser(targetUserId: string): Promise<Friendship> {
    const response = await apiClient.delete(`/friend/unfriend/${targetUserId}`);
    return response.data;
  }

  async cancelSentFriendRequest(targetUserId: string): Promise<Friendship> {
    const response = await apiClient.delete(`/friend/request/${targetUserId}`);
    return response.data;
  }

  async getFriendships(): Promise<EnrichedFriendship[]> {
    const response = await apiClient.get('/friend/');
    return response.data;
  }

  async getUserDetails(userId: string): Promise<{ id: string; username: string } | undefined> {
    try {
      const response = await apiClient.get(`/user/details/${userId}`);
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
