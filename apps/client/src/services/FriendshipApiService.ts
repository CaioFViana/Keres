import apiClient from './apiClient';
import { Friendship } from '@keres/shared/schemas/FriendshipSchemas'; // Assuming Friendship is the type returned by the API

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

  async getFriendships(): Promise<Friendship[]> {
    const response = await apiClient.get('/friend/');
    return response.data;
  }
}

export const friendshipApiService = new FriendshipApiService();
