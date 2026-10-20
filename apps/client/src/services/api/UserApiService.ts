import type {
  AccountPlan,
  UpdateUserPreferencesType,
  UpdateUserProfileType,
  UserPreferencesType,
  UserPublicInfo,
} from '@keres/shared';
import type { ServerSelect } from '@/src/db/schemas/servers';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from '@/src/services/auth/AuthTokenManager';
import { httpStatusOf } from '@/src/utils/errors/errorInfo';

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
    } catch (error) {
      if (httpStatusOf(error) === 404) {
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

  /** Invalidates the current recovery codes on `server` and issues a fresh batch - requires
   *  the current password, same reasoning as changeOwnPassword. */
  async regenerateRecoveryCodes(server: ServerSelect, currentPassword: string): Promise<string[]> {
    const response = await this.clientFor(server).put('/user/recovery-codes', { currentPassword });
    return response.data.recoveryCodes;
  }

  /** Deletes the current user's own account on `server` - requires the current password. */
  async deleteOwnAccount(server: ServerSelect, currentPassword: string): Promise<void> {
    await this.clientFor(server).delete('/user/account', { data: { currentPassword } });
  }

  /** Everything `server` holds about the current user (LGPD access and portability), exactly as it answered. */
  async getOwnData(server: ServerSelect): Promise<Record<string, unknown>> {
    const response = await this.clientFor(server).get<Record<string, unknown>>('/user/data');
    return response.data;
  }

  /** The plan the current user has on `server`, or `undefined` from a server older than this route. */
  async getOwnPlan(server: ServerSelect): Promise<AccountPlan | null> {
    try {
      const response = await this.clientFor(server).get<AccountPlan>('/user/plan');
      return response.data;
    } catch (error: unknown) {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return null;
      throw error;
    }
  }

  /**
   * The owner's private preferences on `server` (the adults-only choice and whether the account is verified), or
   * `null` from a server older than this route.
   */
  async getPreferences(server: ServerSelect): Promise<UserPreferencesType | null> {
    try {
      const response = await this.clientFor(server).get<UserPreferencesType>('/user/preferences');
      return response.data;
    } catch (error: unknown) {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return null;
      throw error;
    }
  }

  /** Sets the adults-only choice on `server`. A 403 means the account is not age-verified there. */
  async updatePreferences(
    server: ServerSelect,
    preferences: UpdateUserPreferencesType,
  ): Promise<UserPreferencesType> {
    const response = await this.clientFor(server).put<UserPreferencesType>(
      '/user/preferences',
      preferences,
    );
    return response.data;
  }

  /** The current user's own profile on `server`, including avatar/bio - `server.idUser` is
   *  this account's own id on that server. */
  async getOwnProfile(server: ServerSelect): Promise<UserPublicInfo | undefined> {
    try {
      const response = await this.clientFor(server).get(`/user/details/${server.idUser}`);
      return response.data;
    } catch (error) {
      if (httpStatusOf(error) === 404) {
        return undefined;
      }
      throw error;
    }
  }
}

export const userApiService = new UserApiService();
