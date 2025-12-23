import { FriendshipInsert, friendships, FriendshipSelect } from '@/src/db/schemas/friendships';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { AppDrizzleClient } from '../db';
import { createULID } from '../utils/ulid';
import { eq, or } from 'drizzle-orm';

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

  async updateFriendship(id: string, data: Partial<FriendshipInsert>): Promise<void> {
    await this.db.update(friendships).set({ ...data, updatedAt: new Date() }).where(eq(friendships.id, id)).run();
  }

  async deleteFriendship(id: string): Promise<void> {
    await this.db.delete(friendships).where(eq(friendships.id, id)).run();
  }
}
