import { UpdateUserProfileType, UserPublicInfo } from '@keres/shared';
import { ServerSelect } from '../db/schemas/servers';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from './AuthTokenManager';

export class UserApiService {
  // Same reasoning as FriendshipApiService: never reuse the shared `apiClient` here,
  // since the caller may be resolving/editing a tag on a server that isn't the one
  // apiClient currently happens to be pointed at.
  private clientFor(server: ServerSelect) {
    const client = createKeresAxiosInstance({ baseURL: server.url });
    client.setTokenProvider(authTokenManager);
    client.setActiveServer(server);
    return client;
  }

  async getUserByTag(server: ServerSelect, tag: string): Promise<UserPublicInfo | undefined> {
    try {
      const response = await this.clientFor(server).get(`/user/by-tag/${encodeURIComponent(tag)}`);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  async updateOwnTag(server: ServerSelect, newTag: string): Promise<UserPublicInfo> {
    const response = await this.clientFor(server).put('/user/tag', { tag: newTag });
    return response.data;
  }

  async updateProfile(
    server: ServerSelect,
    profile: UpdateUserProfileType,
  ): Promise<UserPublicInfo> {
    const response = await this.clientFor(server).put('/user/profile', profile);
    return response.data;
  }

  /** Self-service password change on `server` - requires the current password, unlike the admin panel's reset. */
  async changeOwnPassword(
    server: ServerSelect,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.clientFor(server).put('/user/password', { currentPassword, newPassword });
  }

  /** The current user's own profile on `server`, including avatar/bio - `server.idUser` is
   *  this account's own id on that server. */
  async getOwnProfile(server: ServerSelect): Promise<UserPublicInfo | undefined> {
    try {
      const response = await this.clientFor(server).get(`/user/details/${server.idUser}`);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return undefined;
      }
      throw error;
    }
  }
}

export const userApiService = new UserApiService();
