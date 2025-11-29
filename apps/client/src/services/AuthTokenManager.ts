import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { servers } from '../db/schema';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { createKeresAxiosInstance, TokenProvider } from './apiClient';

let drizzleDb: AppDrizzleClient | null = null;

// Function to initialize the database instance for the AuthTokenManager
export const setAuthDb = (db: AppDrizzleClient) => {
    drizzleDb = db;
};

class AuthTokenManager implements TokenProvider {

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

            // Update in Zustand store
            useUserSettingsStore.getState().setActiveServer({
                ...activeServer,
                jwtToken: accessToken,
                refreshToken: refreshToken,
            });
            console.log(`Tokens updated for server: ${activeServer.name}`);
        } catch (error) {
            console.log('Failed to update tokens in DB/store:', error);
        }
    }

    public async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
        const serverUrl = this.getServerUrl();
        if (!serverUrl) {
            console.log('No server URL available for token refresh.');
            return null;
        }

        try {
            // Use a temporary axios instance (without the token interceptors) to prevent recursion
            // and ensure the refresh request itself isn't blocked.
            const refreshInstance = createKeresAxiosInstance({
                baseURL: serverUrl,
            });

            // The refresh endpoint might not need the Authorization header,
            // or it might expect the refresh token in the body.
            // For now, we are sending it in the body as per the common pattern.
            const response = await refreshInstance.post<{ accessToken: string; refreshToken: string }>(
                '/auth/refresh',
                { refreshToken: refreshToken }
            );

            const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

            await this.updateTokens(newAccessToken, newRefreshToken);

            return { accessToken: newAccessToken, refreshToken: newRefreshToken };
        } catch (error) {
            console.log('Error during token refresh:', error);
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
            return;
        }

        console.log(`Clearing authentication for server: ${activeServer.name}`);
        drizzleDb.update(servers)
            .set({ jwtToken: null, refreshToken: null })
            .where(eq(servers.id, activeServer.id))
            .then(() => {
                useUserSettingsStore.getState().clearActiveServer();
                console.log(`Auth cleared for server: ${activeServer.name}`);
            })
            .catch(error => console.log('Failed to clear auth in DB:', error));
    }
}

export const authTokenManager = new AuthTokenManager();
