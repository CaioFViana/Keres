import { FriendshipInsert, friendships, FriendshipSelect } from '@/src/db/schemas/friendships'; // Import friendships here
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { eq, or } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { createULID } from '../utils/ulid';
import { friendshipApiService } from './FriendshipApiService'; // Import the API service
import { EnrichedFriendship } from '@keres/shared'; // Keep EnrichedFriendship for API interaction

export const createFriendshipService = (db: AppDrizzleClient) => {
  return new FriendshipService(db);
};

export class FriendshipService {
  constructor(private db: AppDrizzleClient) { }

  async getAllFriendships(currentUserId: string): Promise<FriendshipSelect[]> { // Changed return type
    return this.db.select()
      .from(friendships)
      .where(or(
        eq(friendships.senderId, currentUserId),
        eq(friendships.receiverId, currentUserId)
      ))
      .all(); // No cast needed, it's already FriendshipSelect[]
  }

  async getFriendshipById(id: string): Promise<FriendshipSelect | undefined> { // Changed return type
    const friendship = await this.db.select().from(friendships).where(eq(friendships.id, id)).get();
    return friendship; // No cast needed
  }

  async addFriendship(data: Omit<FriendshipInsert, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>): Promise<FriendshipSelect> { // Changed data param
    const newFriendship: FriendshipInsert = {
      id: createULID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 0,
      isDeleted: false,
      deletedAt: null,
      ...data,
    };
    await this.db.insert(friendships).values(newFriendship).run();
    return newFriendship as FriendshipSelect; // Cast for consistency if needed, but should be fine
  }

  async bulkAddFriendships(friendshipData: FriendshipInsert[]): Promise<void> {
    if (friendshipData.length > 0) {
      await this.db.insert(friendships).values(friendshipData).run();
    }
  }

  async updateFriendship(id: string, data: Partial<FriendshipInsert>): Promise<void> {
    await this.db.update(friendships).set({ ...data, updatedAt: new Date() }).where(eq(friendships.id, id)).run();
  }

  async deleteFriendship(id: string): Promise<void> {
    await this.db.delete(friendships).where(eq(friendships.id, id)).run();
  }

  async clearAllFriendshipsForUser(currentUserId: string): Promise<void> {
    await this.db.delete(friendships)
      .where(or(
        eq(friendships.senderId, currentUserId),
        eq(friendships.receiverId, currentUserId)
      ))
      .run();
  }

  async syncFriendshipsWithServer(currentUserId: string, serverId: string): Promise<void> {
    try {
      console.log(`FriendshipService: Syncing friendships with server ${serverId} for user ${currentUserId}`);
      const serverFriendships: EnrichedFriendship[] = await friendshipApiService.getFriendships();

      const friendshipsToInsert: FriendshipInsert[] = serverFriendships.map(sf => {
        // sf (EnrichedFriendship from API) does NOT have serverId.
        // We add serverId from the current context when inserting to local DB.
        return {
          id: sf.id,
          senderId: sf.senderId,
          receiverId: sf.receiverId,
          friendUsername: sf.friendUsername,
          status: sf.status,
          createdAt: sf.createdAt,
          updatedAt: sf.updatedAt,
          serverId: serverId, // serverId is always taken from the current server context
          version: 0, // Default for new inserts
          isDeleted: false, // Default for new inserts
          deletedAt: null, // Default for new inserts
        };
      });

      await this.bulkAddFriendships(friendshipsToInsert);

      console.log(`FriendshipService: Successfully synced ${friendshipsToInsert.length} friendships.`);
    } catch (error) {
      console.error('FriendshipService: Error syncing friendships with server:', error);
      throw error;
    }
  }
}
