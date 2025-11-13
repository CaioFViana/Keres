import { eq } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { ServerInsert, ServerSelect, servers } from '../db/schema';
import { Create, prepareNewEntityData } from '../utils/entityUtils';

export interface ServerService {
  getAllServers(): Promise<ServerSelect[]>;
  getServerById(serverId: string): Promise<ServerSelect | undefined>;
  createServer(serverData: Create<ServerInsert>): Promise<ServerSelect>;
  updateServer(serverId: string, serverData: Partial<Omit<ServerInsert, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>>): Promise<void>;
  deleteServer(serverId: string): Promise<void>;
}

export const createServerService = (db: AppDrizzleClient): ServerService => {
  return {
    async getAllServers(): Promise<ServerSelect[]> {
      return db.select().from(servers).where(eq(servers.isDeleted, false)).all();
    },

    async getServerById(serverId: string): Promise<ServerSelect | undefined> {
      return db.select().from(servers).where(eq(servers.id, serverId)).where(eq(servers.isDeleted, false)).get();
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
  };
};
