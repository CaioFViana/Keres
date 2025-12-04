import { and, eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { ServerInsert, ServerSelect, servers } from '../db/schema';
import { useNotificationStore } from '../state/notificationStore';
import { Create, prepareNewEntityData } from '../utils/entityUtils';
import { isJwtExpired } from '../utils/jwtUtils'; // Added
import { authTokenManager } from './AuthTokenManager';

export interface ServerService {
  getAllServers(): Promise<ServerSelect[]>;
  getServerById(serverId: string): Promise<ServerSelect | undefined>;
  createServer(serverData: Create<ServerInsert>): Promise<ServerSelect>;
  updateServer(serverId: string, serverData: Partial<Omit<ServerInsert, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void>;
  deleteServer(serverId: string): Promise<void>;
  refreshServerToken(server: ServerSelect): Promise<ServerSelect>; // Added
}

export const createServerService = (db: AppDrizzleClient): ServerService => {
  const { showNotification } = useNotificationStore.getState();

  return {
    async getAllServers(): Promise<ServerSelect[]> {
      return db.query.servers.findMany({
        where: eq(servers.isDeleted, false),
      });
    },

    async getServerById(serverId: string): Promise<ServerSelect | undefined> {
      return db.query.servers.findFirst({
        where: and(eq(servers.id, serverId), eq(servers.isDeleted, false)),
      });
    },

    async createServer(serverData): Promise<ServerSelect> {
      const newServer = prepareNewEntityData<ServerInsert>(serverData);
      const result = await db.insert(servers).values(newServer).returning().get();
      return result;
    },

    async updateServer(serverId: string, serverData): Promise<void> {
      await db.update(servers)
        .set({ ...serverData, updatedAt: new Date() })
        .where(eq(servers.id, serverId))
        .run();
    },

    async deleteServer(serverId: string): Promise<void> {
      await db.update(servers)
        .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(servers.id, serverId))
        .run();
    },

    async refreshServerToken(server: ServerSelect): Promise<ServerSelect> {
      if (!server.jwtToken || !server.refreshToken) {
        const message = `Server ${server.name} does not have JWT or Refresh Token. Please re-authenticate.`;
        console.log(message);
        showNotification(message, 'error');
        return server;
      }

      // Check if the JWT is actually expired before trying to refresh
      if (!isJwtExpired(server.jwtToken)) {
        console.log(`JWT for server ${server.name} is not expired. No refresh needed.`);
        return server; // Return current server if not expired
      }

      console.log(`Attempting to refresh token for server ${server.name}...`);
      try {
        // Trigger the token refresh via the AuthTokenManager
        // This will update the tokens in the database and the user settings store
        const refreshedTokens = await authTokenManager.refreshAccessToken(server.id, server.refreshToken);

        if (!refreshedTokens) {
          const message = `Token refresh failed for server ${server.name}. Please re-authenticate.`;
          console.log(message);
          showNotification(message, 'error');
          return server; // Return original server if refresh failed
        }

        // Fetch the updated server object from the database to ensure consistency
        const updatedServer = await db.query.servers.findFirst({
          where: eq(servers.id, server.id),
        });

        if (!updatedServer) {
            const message = `Could not find updated server with ID ${server.id} after token refresh. Please check server status.`;
            console.log(message);
            showNotification(message, 'error');
            return server;
        }

        console.log(`Successfully refreshed tokens for server ${server.name}.`);
        showNotification(`Tokens for ${server.name} refreshed successfully.`, 'success');
        return updatedServer;

      } catch (error) {
        const message = `Failed to refresh token for server ${server.name}. Please re-authenticate.`;
        console.log(message, error);
        showNotification(message, 'error');
        return server; // Return original server on any refresh error
      }
    },
  };
};
