import { FriendshipInsert, friendships, FriendshipSelect } from '@/src/db/schemas/friendships';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { eq, or } from 'drizzle-orm';
import { AppDrizzleClient } from '../db';
import { createULID } from '../utils/ulid';
import { friendshipApiService } from './FriendshipApiService'; // Import the API service


export const createFriendshipService = (db: AppDrizzleClient) => {
  return new FriendshipService(db);
};

export class FriendshipService {
  constructor(private db: AppDrizzleClient) { }

  async getAllFriendships(currentUserId: string): Promise<FriendshipSelect[]> {
    return this.db.select()
      .from(friendships)
      .where(or(
        eq(friendships.user1Id, currentUserId),
        eq(friendships.user2Id, currentUserId)
      ))
      .all();
  }

  async getFriendshipById(id: string): Promise<FriendshipSelect | undefined> {
    return this.db.select().from(friendships).where(eq(friendships.id, id)).get();
  }

  async addFriendship(data: { user1Id: string; user2Id: string; serverId: string; status: FriendStatus; }): Promise<FriendshipSelect> {
    const newFriendship: FriendshipInsert = {
      id: createULID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.db.insert(friendships).values(newFriendship).run();
    return newFriendship as FriendshipSelect;
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
        eq(friendships.user1Id, currentUserId),
        eq(friendships.user2Id, currentUserId)
      ))
      .run();
  }

  async syncFriendshipsWithServer(currentUserId: string, serverId: string): Promise<void> {
    try {
      console.log(`FriendshipService: Syncing friendships with server ${serverId} for user ${currentUserId}`);
      const serverFriendships = await friendshipApiService.getFriendships();

      // Prepare friendships for bulk insertion
      const friendshipsToInsert: FriendshipInsert[] = serverFriendships.map(sf => ({
        id: sf.id,
        user1Id: sf.user1Id,
        user2Id: sf.user2Id,
        status: sf.status,
        createdAt: sf.createdAt,
        updatedAt: sf.updatedAt,
        serverId: serverId,
      }));

      // Insert fetched friendships into the local database
      await this.bulkAddFriendships(friendshipsToInsert);

      console.log(`FriendshipService: Successfully synced ${friendshipsToInsert.length} friendships.`);
    } catch (error) {
      console.error('FriendshipService: Error syncing friendships with server:', error);
      throw error;
    }
  }
}
