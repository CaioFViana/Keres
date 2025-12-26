import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { servers, ServerSelect } from '../db/schema';
import { useUserSettingsStore } from '../state/userSettingsStore';
import apiClient, { createKeresAxiosInstance, TokenProvider } from './apiClient';

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

    // This method is called by the API client's response interceptor upon successful token refresh
    public async updateTokens(accessToken: string, refreshToken: string) {
        const activeServer = useUserSettingsStore.getState().activeServer;
        if (!activeServer || !drizzleDb) {
            console.log('Cannot update tokens: no active server or database not set.');
            return;
        }

        try {
            // Update in Drizzle DB
            await drizzleDb.update(servers)
                .set({
                    jwtToken: accessToken,
                    refreshToken: refreshToken,
                })
                .where(eq(servers.id, activeServer.id));

            const updatedActiveServer = {
                ...activeServer,
                jwtToken: accessToken,
                refreshToken: refreshToken,
            };

            // Update in Zustand store
            useUserSettingsStore.getState().setActiveServer(updatedActiveServer);

            // Also update the apiClient's internal active server
            apiClient.setActiveServer(updatedActiveServer);

            // console.log(`Tokens updated for server: ${activeServer.name}`);
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
            this.clearAuth(); // Clear auth if server info is missing
            return null;
        }

        // Use the refresh token from the database, which should be the most up-to-date
        // The currentRefreshToken parameter is a fallback or for initial checks, but the DB is authoritative.
        const refreshTokenToUse = server.refreshToken || currentRefreshToken;

        if (!refreshTokenToUse) {
            console.log('AuthTokenManager: No refresh token available for server. Clearing authentication.');
            this.clearAuth();
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

            await this.updateTokens(newAccessToken, newRefreshToken); // This will update useUserSettingsStore and apiClient.activeServer
            console.log('AuthTokenManager: Tokens refreshed successfully for server:', server.name);

            return { accessToken: newAccessToken, refreshToken: newRefreshToken };
        } catch (error) {
            console.log('AuthTokenManager: Error during token refresh for server:', server.name, error);
            this.clearAuth(); // Clear auth if refresh fails
            return null;
        }
    }

    public clearAuth(): void {
        const activeServer = useUserSettingsStore.getState().activeServer;
        if (!activeServer || !drizzleDb) {
            console.log('Cannot clear auth: no active server or database not set.');
            // Even if DB is not set, try to clear from store if activeServer exists
            if (activeServer) {
                useUserSettingsStore.getState().clearActiveServer();
            }
            // Also clear apiClient's active server context
            apiClient.setActiveServer(null);
            return;
        }

        // console.log(`Clearing authentication for server: ${activeServer.name}`);
        drizzleDb.update(servers)
            .set({ jwtToken: null, refreshToken: null })
            .where(eq(servers.id, activeServer.id))
            .then(() => {
                useUserSettingsStore.getState().clearActiveServer();
                apiClient.setActiveServer(null); // Clear apiClient's active server context
                // console.log(`Auth cleared for server: ${activeServer.name}`);
            })
            .catch(error => console.log('Failed to clear auth in DB:', error));
    }
}

export const authTokenManager = new AuthTokenManager();

