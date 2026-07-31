import { EnrichedFriendship, Friendship, FriendStatus } from '@keres/shared';
import { and, eq, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ulid } from 'ulid';
import { db } from '../db';
import { friendships } from '../db/schema/tables/friendships';
import { users } from '../db/schema/tables/users';
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


  async sendFriendRequest(senderId: string, receiverId: string): Promise<Friendship> {
    if (senderId === receiverId) {
      throw new Error('Cannot send friend request to self.');
    }

    await this.checkUserExistence(senderId);
    await this.checkUserExistence(receiverId);

    // Check for an existing direct pending request (sender -> receiver)
    const existingDirectPending = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.senderId, senderId),
        eq(friendships.receiverId, receiverId),
        eq(friendships.status, FriendStatus.PENDING)
      ),
    });
    if (existingDirectPending) {
      throw new Error('Friend request already pending from you to you. Please approve the pending request.');
    }

    // Check for an existing reverse pending request (receiver -> sender)
    const existingReversePending = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.senderId, receiverId),
        eq(friendships.receiverId, senderId),
        eq(friendships.status, FriendStatus.PENDING)
      ),
    });
    if (existingReversePending) {
      throw new Error('There is a pending friend request from this user to you.');
    }

    // Check for any existing non-pending friendship (FRIEND, BLACKLISTED) in either direction
    const existingEstablishedFriendship = await db.query.friendships.findFirst({
      where: or(
        and(eq(friendships.senderId, senderId), eq(friendships.receiverId, receiverId)),
        and(eq(friendships.senderId, receiverId), eq(friendships.receiverId, senderId))
      ),
    });

    if (existingEstablishedFriendship) {
      if (existingEstablishedFriendship.status === FriendStatus.FRIEND) {
        throw new Error('Already friends.');
      } else if (existingEstablishedFriendship.status === FriendStatus.BLACKLISTED) {
        throw new Error('A blacklisted relationship exists between these users, cannot send request.');
      }
      // If it's another status (e.g., PENDING, but not covered by above checks, though it should be)
      throw new Error('An existing friendship relationship is preventing this request.');
    }

    const newFriendshipData = {
      id: ulid(),
      senderId: senderId,
      receiverId: receiverId,
      status: FriendStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newFriendship = await db.insert(friendships).values(newFriendshipData).returning();
    
    return newFriendship[0];
  }
  async acceptFriendRequest(userId: string, targetUserId: string): Promise<Friendship> {
    await this.checkUserExistence(userId);       // userId is the one trying to accept
    await this.checkUserExistence(targetUserId);  // targetUserId is the one who sent the request

    // Find the pending friendship where userId is the receiver and targetUserId is the sender
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.senderId, targetUserId), // targetUserId must be the sender
        eq(friendships.receiverId, userId),     // userId must be the receiver
        eq(friendships.status, FriendStatus.PENDING)
      ),
    });

    if (!existingFriendship) {
      throw new Error('Friend request not found or not pending from this user.');
    }

    // Authorization check: Ensure the authenticated user (userId) is indeed the receiver
    // and that targetUserId is indeed the sender of *this specific pending request*.
    if (existingFriendship.receiverId !== userId) {
      throw new Error('Unauthorized: You are not the recipient of this friend request.');
    }
    if (existingFriendship.senderId !== targetUserId) {
      throw new Error('Unauthorized: The target user is not the sender of this request.');
    }


    const updatedFriendship = await db.update(friendships)
      .set({ status: FriendStatus.FRIEND, updatedAt: new Date() })
      .where(eq(friendships.id, existingFriendship.id))
      .returning();
    
    return updatedFriendship[0];
  }

  async declineFriendRequest(userId: string, targetUserId: string): Promise<void> {
    await this.checkUserExistence(userId);       // userId is the one trying to decline
    await this.checkUserExistence(targetUserId);  // targetUserId is the one who sent the request

    // Find the pending friendship where userId is the receiver and targetUserId is the sender
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.senderId, targetUserId), // targetUserId must be the sender
        eq(friendships.receiverId, userId),     // userId must be the receiver
        eq(friendships.status, FriendStatus.PENDING)
      ),
    });

    if (!existingFriendship) {
      throw new Error('Friend request not found or not pending from this user.');
    }

    // Authorization check: Ensure the authenticated user (userId) is indeed the receiver
    // and that targetUserId is indeed the sender of *this specific pending request*.
    if (existingFriendship.receiverId !== userId) {
      throw new Error('Unauthorized: You are not the recipient of this friend request.');
    }
    if (existingFriendship.senderId !== targetUserId) {
      throw new Error('Unauthorized: The target user is not the sender of this request.');
    }

    await db.delete(friendships).where(eq(friendships.id, existingFriendship.id));

    // After declining a friend request, delete any associated story permissions
    await storyPermissionService.deletePermissionsBetweenUsers(existingFriendship.senderId, existingFriendship.receiverId);
  }

  async unfriendUser(userId: string, targetUserId: string): Promise<void> {
    await this.checkUserExistence(userId);
    await this.checkUserExistence(targetUserId);

    // Find the FRIEND friendship between userId and targetUserId, regardless of who was sender/receiver
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        or(
          and(eq(friendships.senderId, userId), eq(friendships.receiverId, targetUserId)),
          and(eq(friendships.senderId, targetUserId), eq(friendships.receiverId, userId))
        ),
        eq(friendships.status, FriendStatus.FRIEND)
      ),
    });

    if (!existingFriendship) {
      throw new Error('Users are not friends.');
    }

    await db.delete(friendships).where(eq(friendships.id, existingFriendship.id));

    // After unfriending, delete any associated story permissions
    await storyPermissionService.deletePermissionsBetweenUsers(existingFriendship.senderId, existingFriendship.receiverId);
  }

  async blacklistUser(blisterId: string, blacklistedUserId: string): Promise<Friendship> {
    if (blisterId === blacklistedUserId) {
      throw new Error('Cannot blacklist self.');
    }

    await this.checkUserExistence(blisterId);
    await this.checkUserExistence(blacklistedUserId);

    let existingFriendship = await db.query.friendships.findFirst({
      where: or(
        and(eq(friendships.senderId, blisterId), eq(friendships.receiverId, blacklistedUserId)),
        and(eq(friendships.senderId, blacklistedUserId), eq(friendships.receiverId, blisterId))
      ),
    });

    if (existingFriendship) {
      if (existingFriendship.status === FriendStatus.BLACKLISTED) {
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
        await storyPermissionService.deletePermissionsBetweenUsers(existingFriendship.senderId, existingFriendship.receiverId);
      }
      return updatedFriendship[0];
    } else {
      // Create new blacklisted friendship
      const newFriendshipData = {
        id: ulid(),
        senderId: blisterId,
        receiverId: blacklistedUserId,
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

    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        or(
          and(eq(friendships.senderId, unblisterId), eq(friendships.receiverId, unblacklistedUserId)),
          and(eq(friendships.senderId, unblacklistedUserId), eq(friendships.receiverId, unblisterId))
        ),
        eq(friendships.status, FriendStatus.BLACKLISTED)
      ),
    });

    if (!existingFriendship) {
      throw new Error('User is not blacklisted by you.');
    }

    await db.delete(friendships).where(eq(friendships.id, existingFriendship.id));
  }

  async cancelSentFriendRequest(senderId: string, targetUserId: string): Promise<void> {
    await this.checkUserExistence(senderId);
    await this.checkUserExistence(targetUserId);

    // Find the pending friendship where senderId is the sender and targetUserId is the receiver
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.senderId, senderId),
        eq(friendships.receiverId, targetUserId),
        eq(friendships.status, FriendStatus.PENDING)
      ),
    });

    if (!existingFriendship) {
      throw new Error('Sent friend request not found or not pending.');
    }

    await db.delete(friendships).where(eq(friendships.id, existingFriendship.id));
  }


  async getFriendships(userId: string): Promise<EnrichedFriendship[]> {
    await this.checkUserExistence(userId);

    const friendUserAlias = alias(users, 'friendUser');

    const friendshipsData = await db
      .select({
        id: friendships.id,
        senderId: friendships.senderId,
        receiverId: friendships.receiverId,
        status: friendships.status,
        createdAt: friendships.createdAt,
        updatedAt: friendships.updatedAt,
        // Corrected: friendUserAlias.username correctly identifies the other user's username due to the join condition.
        friendUsername: friendUserAlias.username, 
        // otherUserId is dynamically determined based on which user in the friendship is not the current userId.
        otherUserId: sql<string>`
          CASE
            WHEN ${friendships.senderId} = ${userId} THEN ${friendships.receiverId}
            ELSE ${friendships.senderId}
          END
        `.as('otherUserId'),
      })
      .from(friendships)
      .leftJoin(friendUserAlias, or(
        and(eq(friendships.senderId, userId), eq(friendships.receiverId, friendUserAlias.id)),
        and(eq(friendships.receiverId, userId), eq(friendships.senderId, friendUserAlias.id))
      ))
      .where(or(eq(friendships.senderId, userId), eq(friendships.receiverId, userId)));


    const enrichedFriendships: EnrichedFriendship[] = friendshipsData.map(f => {
      return {
        id: f.id,
        senderId: f.senderId,
        receiverId: f.receiverId,
        status: f.status,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        friendUsername: f.friendUsername || '',
        otherUserId: f.otherUserId || '', // Ensure otherUserId is included now that EnrichedFriendship type includes it
      };
    });

    return enrichedFriendships;
  }

  async getFriendshipById(friendshipId: string): Promise<Friendship | undefined> {
    return db.query.friendships.findFirst({
      where: eq(friendships.id, friendshipId),
    });
  }
}

export const friendshipService = new FriendshipService();
