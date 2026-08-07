import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { servers, ServerSelect } from '../db/schema';
import { useUserSettingsStore } from '../state/userSettingsStore';
import apiClient, { clearServerTokenCache, createKeresAxiosInstance, isOfflineError, TokenProvider, updateServerTokenCache } from './apiClient';

let drizzleDb: AppDrizzleClient | null = null;

// Function to initialize the database instance for the AuthTokenManager
export const setAuthDb = (db: AppDrizzleClient) => {
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
        return activeServer?.jwtToken || null;
    }

    public getRefreshToken(): string | null {
        const activeServer = useUserSettingsStore.getState().activeServer;
        return activeServer?.refreshToken || null;
    }

    public getServerUrl(): string | null {
        const activeServer = useUserSettingsStore.getState().activeServer;
        return activeServer?.url || null;
    }

    // This method is called by the API client's response interceptor upon successful token refresh.
    // Takes an explicit serverId rather than reading useUserSettingsStore's "activeServer", because
    // the refresh that just succeeded may belong to a background sync for a server that isn't the
    // one currently open in the UI - writing its tokens onto the wrong server would be a real bug.
    public async updateTokens(serverId: string, accessToken: string, refreshToken: string) {
        if (!drizzleDb) {
            console.log('Cannot update tokens: database not set.');
            return;
        }

        try {
            // Update in Drizzle DB
            await drizzleDb.update(servers)
                .set({
                    jwtToken: accessToken,
                    refreshToken: refreshToken,
                })
                .where(eq(servers.id, serverId));

            // Update the shared token cache so every Axios instance configured for this
            // server (SyncEngineService's client included, not just the default apiClient)
            // picks up the refreshed token on its next request.
            updateServerTokenCache(serverId, accessToken, refreshToken);

            // Keep the UI-facing "active server" in sync only if it's the same server being refreshed.
            const activeServer = useUserSettingsStore.getState().activeServer;
            if (activeServer?.id === serverId) {
                const updatedActiveServer = {
                    ...activeServer,
                    jwtToken: accessToken,
                    refreshToken: refreshToken,
                };
                useUserSettingsStore.getState().setActiveServer(updatedActiveServer);
                apiClient.setActiveServer(updatedActiveServer);
            }
        } catch (error) {
            console.log('Failed to update tokens in DB/store:', error);
        }
    }

    public async refreshAccessToken(serverId: string, currentRefreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
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

        // Use the refresh token from the database, which should be the most up-to-date
        // The currentRefreshToken parameter is a fallback or for initial checks, but the DB is authoritative.
        const refreshTokenToUse = server.refreshToken || currentRefreshToken;

        if (!refreshTokenToUse) {
            console.log('AuthTokenManager: No refresh token available for server. Clearing authentication.');
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
                { refreshToken: refreshTokenToUse }
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
                console.log(`AuthTokenManager: Server ${server.name} unreachable, keeping existing tokens.`);
                return null;
            }
            console.log('AuthTokenManager: Error during token refresh for server:', server.name, (error as Error)?.message || error);
            this.clearAuth(serverId); // Credentials genuinely rejected - clear them
            return null;
        }
    }

    // Takes an explicit serverId for the same reason updateTokens does: the caller (typically the
    // response interceptor after a failed refresh) knows exactly which server failed, and it may not
    // be the one the UI currently considers "active".
    public clearAuth(serverId: string): void {
        clearServerTokenCache(serverId);

        const activeServer = useUserSettingsStore.getState().activeServer;
        const isActiveServer = activeServer?.id === serverId;

        if (!drizzleDb) {
            console.log('Cannot clear auth in DB: database not set.');
            if (isActiveServer) {
                useUserSettingsStore.getState().clearActiveServer();
                apiClient.setActiveServer(null);
            }
            return;
        }

        drizzleDb.update(servers)
            .set({ jwtToken: null, refreshToken: null })
            .where(eq(servers.id, serverId))
            .then(() => {
                // Only reset the UI-facing "active server" if it's the one we just cleared.
                if (isActiveServer) {
                    useUserSettingsStore.getState().clearActiveServer();
                    apiClient.setActiveServer(null);
                }
            })
            .catch(error => console.log('Failed to clear auth in DB:', error));
    }
}

export const authTokenManager = new AuthTokenManager();

