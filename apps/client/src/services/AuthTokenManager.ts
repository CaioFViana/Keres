import { AppDrizzleClient } from '../db';
import { ServerSelect } from '../db/schema';
import { useUserSettingsStore } from '../state/userSettingsStore';
import apiClient, {
  clearAllServerAuthState,
  clearServerTokenCache,
  createKeresAxiosInstance,
  isOfflineError,
  TokenProvider,
  updateServerTokenCache,
} from './apiClient';
import { AuthTokens, tokenVault } from './TokenVault';

let drizzleDb: AppDrizzleClient | null = null;

// Function to initialize the database instance for the AuthTokenManager
export const setAuthDb = (db: AppDrizzleClient | null) => {
  drizzleDb = db;
};

class AuthTokenManager implements TokenProvider {
  private _getServerById: ((serverId: string) => Promise<ServerSelect | undefined>) | null = null;

  public setGetServerById(func: (serverId: string) => Promise<ServerSelect | undefined>): void {
    this._getServerById = func;
  }

  // These methods are no longer directly used by apiClient as it now manages its own active server context.
  // They are kept for TokenProvider interface compatibility, but will return values from useUserSettingsStore
  // which might not always reflect the apiClient's *current* internal server context during complex operations.
  public getAccessToken(): string | null {
    const activeServer = useUserSettingsStore.getState().activeServer;
    return activeServer ? tokenVault.peek(activeServer.id)?.accessToken || null : null;
  }

  public getRefreshToken(): string | null {
    const activeServer = useUserSettingsStore.getState().activeServer;
    return activeServer ? tokenVault.peek(activeServer.id)?.refreshToken || null : null;
  }

  public getServerUrl(): string | null {
    const activeServer = useUserSettingsStore.getState().activeServer;
    return activeServer?.url || null;
  }

  public async hydrateTokens(): Promise<void> {
    if (!drizzleDb) return;
    const savedServers = await drizzleDb.query.servers.findMany();
    for (const server of savedServers) {
      const tokens = await tokenVault.get(server.id);
      if (tokens) updateServerTokenCache(server.id, tokens.accessToken, tokens.refreshToken);
    }
  }

  public async getTokens(serverId: string): Promise<AuthTokens | null> {
    return tokenVault.get(serverId);
  }

  // This method is called by the API client's response interceptor upon successful token refresh.
  // Takes an explicit serverId rather than reading useUserSettingsStore's "activeServer", because
  // the refresh that just succeeded may belong to a background sync for a server that isn't the
  // one currently open in the UI - writing its tokens onto the wrong server would be a real bug.
  public async updateTokens(serverId: string, accessToken: string, refreshToken: string) {
    try {
      await tokenVault.set(serverId, { accessToken, refreshToken });
      // Update the shared token cache so every Axios instance configured for this
      // server (SyncEngineService's client included, not just the default apiClient)
      // picks up the refreshed token on its next request.
      updateServerTokenCache(serverId, accessToken, refreshToken);

      // Keep the UI-facing "active server" in sync only if it's the same server being refreshed.
      const activeServer = useUserSettingsStore.getState().activeServer;
      if (activeServer?.id === serverId) {
        useUserSettingsStore.getState().setActiveServer(activeServer);
        apiClient.setActiveServer(activeServer);
      }
    } catch (error) {
      console.log('Failed to update tokens in secure storage/cache:', error);
      throw error;
    }
  }

  public async refreshAccessToken(
    serverId: string,
    currentRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    if (!drizzleDb) {
      console.log('AuthTokenManager: Database not set for token refresh.');
      return null;
    }

    if (!this._getServerById) {
      console.log('AuthTokenManager: getServerById dependency not set.');
      return null;
    }

    const server = await this._getServerById(serverId); // Use injected function

    if (!server || !server.url) {
      console.log(`AuthTokenManager: Server with ID ${serverId} not found or no URL available.`);
      this.clearAuth(serverId); // Clear auth if server info is missing
      return null;
    }

    // The Vault is authoritative; the parameter is retained as an interceptor fallback.
    const refreshTokenToUse = (await tokenVault.get(serverId))?.refreshToken || currentRefreshToken;

    if (!refreshTokenToUse) {
      console.log(
        'AuthTokenManager: No refresh token available for server. Clearing authentication.',
      );
      this.clearAuth(serverId);
      return null;
    }

    try {
      const refreshInstance = createKeresAxiosInstance({
        baseURL: server.url,
      });

      // Set the active server for the refresh instance to ensure its interceptor uses the correct token
      refreshInstance.setActiveServer(server);

      const refreshEndpoint = '/auth/refresh';

      const response = await refreshInstance.post<{ accessToken: string; refreshToken: string }>(
        refreshEndpoint,
        { refreshToken: refreshTokenToUse },
      );

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

      await this.updateTokens(serverId, newAccessToken, newRefreshToken);
      console.log('AuthTokenManager: Tokens refreshed successfully for server:', server.name);

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (error) {
      if (isOfflineError(error)) {
        // The server is unreachable, which says nothing about whether our
        // credentials are still valid. Clearing them here would silently log the
        // user out of a perfectly good account just because the network blipped.
        console.log(
          `AuthTokenManager: Server ${server.name} unreachable, keeping existing tokens.`,
        );
        return null;
      }
      console.log(
        'AuthTokenManager: Error during token refresh for server:',
        server.name,
        (error as Error)?.message || error,
      );
      this.clearAuth(serverId); // Credentials genuinely rejected - clear them
      return null;
    }
  }

  // Takes an explicit serverId for the same reason updateTokens does: the caller (typically the
  // response interceptor after a failed refresh) knows exactly which server failed, and it may not
  // be the one the UI currently considers "active".
  public clearAuth(serverId: string): void {
    void this.clearAuthForServer(serverId);
  }

  /** Awaitable variant used when removing a locally registered server. */
  public async clearAuthForServer(serverId: string): Promise<void> {
    clearServerTokenCache(serverId);
    try {
      await tokenVault.remove(serverId);
    } catch (error) {
      console.log('Failed to clear secure credentials:', error);
    }

    const activeServer = useUserSettingsStore.getState().activeServer;
    const isActiveServer = activeServer?.id === serverId;

    if (isActiveServer) {
      useUserSettingsStore.getState().clearActiveServer();
      apiClient.setActiveServer(null);
    }
  }

  public async clearAllAuth(serverIds: string[]): Promise<void> {
    await Promise.all(serverIds.map((serverId) => tokenVault.remove(serverId)));
    clearAllServerAuthState(serverIds);
    this._getServerById = null;
    useUserSettingsStore.getState().clearActiveServer();
    apiClient.setActiveServer(null);
  }
}

export const authTokenManager = new AuthTokenManager();
