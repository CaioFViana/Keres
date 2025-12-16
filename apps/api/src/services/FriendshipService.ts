import { Friendship, FriendStatus } from '@keres/shared';
import { ulid } from 'ulid';
import { db } from '../db';
import { friendships } from '../db/schema/tables/friendships';
import { users } from '../db/schema/tables/users';
import { eq, or, and } from 'drizzle-orm';
import { storyPermissionService } from './StoryPermissionService';

export class FriendshipService {
  private async checkUserExistence(userId: string): Promise<void> {
    const userExists = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!userExists) {
      throw new Error(`User with ID ${userId} not found.`);
    }
  }

  private sortUserIds(id1: string, id2: string): { user1: string; user2: string } {
    return id1 < id2 ? { user1: id1, user2: id2 } : { user1: id2, user2: id1 };
  }

  async sendFriendRequest(senderId: string, receiverId: string): Promise<Friendship> {
    if (senderId === receiverId) {
      throw new Error('Cannot send friend request to self.');
    }

    await this.checkUserExistence(senderId);
    await this.checkUserExistence(receiverId);

    const { user1: sortedUser1Id, user2: sortedUser2Id } = this.sortUserIds(senderId, receiverId);

    // Check for existing friendship between these two users
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.user1Id, sortedUser1Id),
        eq(friendships.user2Id, sortedUser2Id)
      ),
    });

    if (existingFriendship) {
      if (existingFriendship.status === FriendStatus.PENDING) {
        throw new Error('Friend request already pending.');
      } else if (existingFriendship.status === FriendStatus.FRIEND) {
        throw new Error('Already friends.');
      } else if (existingFriendship.status === FriendStatus.BLACKLISTED) {
        throw new Error('One of the users has blacklisted the other, or you are blacklisted by them.');
      }
    }

    const newFriendshipData = {
      id: ulid(),
      user1Id: sortedUser1Id,
      user2Id: sortedUser2Id,
      status: FriendStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newFriendship = await db.insert(friendships).values(newFriendshipData).returning();
    return newFriendship[0];
  }

  async acceptFriendRequest(userId: string, targetUserId: string): Promise<Friendship> {
    await this.checkUserExistence(userId);
    await this.checkUserExistence(targetUserId);

    const { user1: sortedUser1Id, user2: sortedUser2Id } = this.sortUserIds(userId, targetUserId);

    // Find the pending friendship where targetUserId is the sender and userId is the receiver
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.user1Id, sortedUser1Id),
        eq(friendships.user2Id, sortedUser2Id),
        eq(friendships.status, FriendStatus.PENDING)
      ),
    });

    if (!existingFriendship) {
      throw new Error('Friend request not found or not pending from this user.');
    }

    if (existingFriendship.user1Id === userId && existingFriendship.user2Id === targetUserId) {
        throw new Error('You cannot accept a request you sent.');
    }
    if (existingFriendship.user2Id !== userId) {
        throw new Error('Unauthorized: You are not the recipient of this friend request.');
    }


    const updatedFriendship = await db.update(friendships)
      .set({ status: FriendStatus.FRIEND, updatedAt: new Date() })
      .where(eq(friendships.id, existingFriendship.id))
      .returning();

    return updatedFriendship[0];
  }

  async declineFriendRequest(userId: string, targetUserId: string): Promise<void> {
    await this.checkUserExistence(userId);
    await this.checkUserExistence(targetUserId);

    const { user1: sortedUser1Id, user2: sortedUser2Id } = this.sortUserIds(userId, targetUserId);

    // Find the pending friendship where targetUserId is the sender and userId is the receiver
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.user1Id, sortedUser1Id),
        eq(friendships.user2Id, sortedUser2Id),
        eq(friendships.status, FriendStatus.PENDING)
      ),
    });

    if (!existingFriendship) {
      throw new Error('Friend request not found or not pending from this user.');
    }

    if (existingFriendship.user1Id === userId && existingFriendship.user2Id === targetUserId) {
        throw new Error('You cannot decline a request you sent.');
    }
    if (existingFriendship.user2Id !== userId) {
        throw new Error('Unauthorized: You are not the recipient of this friend request.');
    }

    await db.delete(friendships).where(eq(friendships.id, existingFriendship.id));

    // New: After declining a friend request, delete any associated story permissions
    await storyPermissionService.deletePermissionsBetweenUsers(existingFriendship.user1Id, existingFriendship.user2Id);
  }

  async unfriendUser(userId: string, targetUserId: string): Promise<void> {
    await this.checkUserExistence(userId);
    await this.checkUserExistence(targetUserId);

    const { user1: sortedUser1Id, user2: sortedUser2Id } = this.sortUserIds(userId, targetUserId);

    // Find the existing FRIEND friendship
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.user1Id, sortedUser1Id),
        eq(friendships.user2Id, sortedUser2Id),
        eq(friendships.status, FriendStatus.FRIEND)
      ),
    });

    if (!existingFriendship) {
      throw new Error('Users are not friends.');
    }

    await db.delete(friendships).where(eq(friendships.id, existingFriendship.id));

    // After unfriending, delete any associated story permissions
    await storyPermissionService.deletePermissionsBetweenUsers(userId, targetUserId);
  }

  async blacklistUser(blisterId: string, blacklistedUserId: string): Promise<Friendship> {
    if (blisterId === blacklistedUserId) {
      throw new Error('Cannot blacklist self.');
    }

    await this.checkUserExistence(blisterId);
    await this.checkUserExistence(blacklistedUserId);

    const { user1: sortedUser1Id, user2: sortedUser2Id } = this.sortUserIds(blisterId, blacklistedUserId);

    let existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.user1Id, sortedUser1Id),
        eq(friendships.user2Id, sortedUser2Id)
      ),
    });

    if (existingFriendship) {
      if (existingFriendship.status === FriendStatus.BLACKLISTED) {
        // Already blacklisted, return the existing one
        return existingFriendship;
      }

      const originalStatus = existingFriendship.status;

      // Update existing friendship to blacklisted
      const updatedFriendship = await db.update(friendships)
        .set({ status: FriendStatus.BLACKLISTED, updatedAt: new Date() })
        .where(eq(friendships.id, existingFriendship.id))
        .returning();

      // If the status changed from FRIEND to BLACKLISTED, delete associated story permissions
      if (originalStatus === FriendStatus.FRIEND) {
        await storyPermissionService.deletePermissionsBetweenUsers(blisterId, blacklistedUserId);
      }
      return updatedFriendship[0];
    } else {
      // Create new blacklisted friendship
      const newFriendshipData = {
        id: ulid(),
        user1Id: sortedUser1Id,
        user2Id: sortedUser2Id,
        status: FriendStatus.BLACKLISTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const newFriendship = await db.insert(friendships).values(newFriendshipData).returning();
      return newFriendship[0];
    }
  }

  async unblacklistUser(unblisterId: string, unblacklistedUserId: string): Promise<void> {
    if (unblisterId === unblacklistedUserId) {
      throw new Error('Cannot unblacklist self.');
    }

    await this.checkUserExistence(unblisterId);
    await this.checkUserExistence(unblacklistedUserId);

    const { user1: sortedUser1Id, user2: sortedUser2Id } = this.sortUserIds(unblisterId, unblacklistedUserId);

    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.user1Id, sortedUser1Id),
        eq(friendships.user2Id, sortedUser2Id),
        eq(friendships.status, FriendStatus.BLACKLISTED)
      ),
    });

    if (!existingFriendship) {
      throw new Error('User is not blacklisted by you.');
    }

    await db.delete(friendships).where(eq(friendships.id, existingFriendship.id));
  }


  async getFriendships(userId: string): Promise<Friendship[]> {
    await this.checkUserExistence(userId);
    return db.query.friendships.findMany({
      where: or(eq(friendships.user1Id, userId), eq(friendships.user2Id, userId)),
    });
  }

  async getFriendshipById(friendshipId: string): Promise<Friendship | undefined> {
    return db.query.friendships.findFirst({
      where: eq(friendships.id, friendshipId),
    });
  }
}

export const friendshipService = new FriendshipService();
