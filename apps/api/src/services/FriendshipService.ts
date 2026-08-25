import type { EnrichedFriendship, Friendship} from '@keres/shared';
import { FriendStatus } from '@keres/shared';
import { and, eq, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ulid } from 'ulid';
import { db } from '../db';
import { friendships } from '../db/schema/tables/friendships';
import { users } from '../db/schema/tables/users';
import { lockUserPair, writeTransactionConfig } from '../db/sqlOperators';
import { AppError } from '../utils/errors';
import { storyPermissionService } from './StoryPermissionService';
import { emitUserEvent } from '../modules/webSocket/webSocket.route';

export class FriendshipService {
  private notifyChanged(...userIds: string[]): void {
    for (const userId of new Set(userIds)) emitUserEvent(userId, { type: 'friendships.changed' });
  }

  /**
   * Profile data is embedded in the enriched friendship payload consumed by clients.
   * Notify both sides whenever one profile changes so every connected device refreshes
   * that payload and its local user/avatar cache immediately.
   */
  async notifyProfileChanged(userId: string): Promise<void> {
    const related = await db
      .select({
        senderId: friendships.senderId,
        receiverId: friendships.receiverId,
      })
      .from(friendships)
      .where(
        and(
          or(eq(friendships.senderId, userId), eq(friendships.receiverId, userId)),
          ne(friendships.status, FriendStatus.BLACKLISTED),
        ),
      );
    const affectedUserIds = related.map((friendship) =>
      friendship.senderId === userId ? friendship.receiverId : friendship.senderId,
    );
    this.notifyChanged(userId, ...affectedUserIds);
  }
  private async checkUserExistence(userId: string): Promise<void> {
    const userExists = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!userExists) {
      throw new AppError(404, `User with ID ${userId} not found.`);
    }
  }

  async sendFriendRequest(senderId: string, receiverId: string): Promise<Friendship> {
    if (senderId === receiverId) {
      throw new AppError(400, 'Cannot send friend request to self.');
    }

    await this.checkUserExistence(senderId);
    await this.checkUserExistence(receiverId);

    const created = await db.transaction(async (tx) => {
      // Serializes any concurrent sendFriendRequest between this exact pair of users, in
      // either direction. Without this, two requests racing in opposite directions (A→B and
      // B→A) can both read "no existing row" before either commits and create two independent
      // rows - the unique constraint on (senderId, receiverId) only catches an exact duplicate
      // (A→B twice), not the reverse direction. Como cada motor faz isso de um jeito, o
      // detalhe mora em `lockUserPair`.
      await lockUserPair(tx, senderId, receiverId);

      // Check for an existing direct pending request (sender -> receiver)
      const existingDirectPending = await tx.query.friendships.findFirst({
        where: and(
          eq(friendships.senderId, senderId),
          eq(friendships.receiverId, receiverId),
          eq(friendships.status, FriendStatus.PENDING),
        ),
      });
      if (existingDirectPending) {
        throw new AppError(
          409,
          'Friend request already pending from you to you. Please approve the pending request.',
        );
      }

      // Check for an existing reverse pending request (receiver -> sender)
      const existingReversePending = await tx.query.friendships.findFirst({
        where: and(
          eq(friendships.senderId, receiverId),
          eq(friendships.receiverId, senderId),
          eq(friendships.status, FriendStatus.PENDING),
        ),
      });
      if (existingReversePending) {
        throw new AppError(409, 'There is a pending friend request from this user to you.');
      }

      // Check for any existing non-pending friendship (FRIEND, BLACKLISTED) in either direction
      const existingEstablishedFriendship = await tx.query.friendships.findFirst({
        where: or(
          and(eq(friendships.senderId, senderId), eq(friendships.receiverId, receiverId)),
          and(eq(friendships.senderId, receiverId), eq(friendships.receiverId, senderId)),
        ),
      });

      if (existingEstablishedFriendship) {
        if (existingEstablishedFriendship.status === FriendStatus.FRIEND) {
          throw new AppError(409, 'Already friends.');
        } else if (existingEstablishedFriendship.status === FriendStatus.BLACKLISTED) {
          throw new AppError(
            403,
            'A blacklisted relationship exists between these users, cannot send request.',
          );
        }
        // If it's another status (e.g., PENDING, but not covered by above checks, though it should be)
        throw new AppError(409, 'An existing friendship relationship is preventing this request.');
      }

      const newFriendshipData = {
        id: ulid(),
        senderId: senderId,
        receiverId: receiverId,
        status: FriendStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newFriendship = await tx.insert(friendships).values(newFriendshipData).returning();
      return newFriendship[0];
    }, writeTransactionConfig);

    this.notifyChanged(senderId, receiverId);
    return created;
  }
  async acceptFriendRequest(userId: string, targetUserId: string): Promise<Friendship> {
    await this.checkUserExistence(userId); // userId is the one trying to accept
    await this.checkUserExistence(targetUserId); // targetUserId is the one who sent the request

    // Find the pending friendship where userId is the receiver and targetUserId is the sender
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.senderId, targetUserId), // targetUserId must be the sender
        eq(friendships.receiverId, userId), // userId must be the receiver
        eq(friendships.status, FriendStatus.PENDING),
      ),
    });

    if (!existingFriendship) {
      throw new AppError(404, 'Friend request not found or not pending from this user.');
    }

    // Authorization check: Ensure the authenticated user (userId) is indeed the receiver
    // and that targetUserId is indeed the sender of *this specific pending request*.
    if (existingFriendship.receiverId !== userId) {
      throw new AppError(403, 'Unauthorized: You are not the recipient of this friend request.');
    }
    if (existingFriendship.senderId !== targetUserId) {
      throw new AppError(403, 'Unauthorized: The target user is not the sender of this request.');
    }

    const updatedFriendship = await db
      .update(friendships)
      .set({ status: FriendStatus.FRIEND, updatedAt: new Date() })
      .where(eq(friendships.id, existingFriendship.id))
      .returning();

    this.notifyChanged(userId, targetUserId);
    return updatedFriendship[0];
  }

  async declineFriendRequest(userId: string, targetUserId: string): Promise<void> {
    await this.checkUserExistence(userId); // userId is the one trying to decline
    await this.checkUserExistence(targetUserId); // targetUserId is the one who sent the request

    // Find the pending friendship where userId is the receiver and targetUserId is the sender
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.senderId, targetUserId), // targetUserId must be the sender
        eq(friendships.receiverId, userId), // userId must be the receiver
        eq(friendships.status, FriendStatus.PENDING),
      ),
    });

    if (!existingFriendship) {
      throw new AppError(404, 'Friend request not found or not pending from this user.');
    }

    // Authorization check: Ensure the authenticated user (userId) is indeed the receiver
    // and that targetUserId is indeed the sender of *this specific pending request*.
    if (existingFriendship.receiverId !== userId) {
      throw new AppError(403, 'Unauthorized: You are not the recipient of this friend request.');
    }
    if (existingFriendship.senderId !== targetUserId) {
      throw new AppError(403, 'Unauthorized: The target user is not the sender of this request.');
    }

    await db.delete(friendships).where(eq(friendships.id, existingFriendship.id));

    // After declining a friend request, delete any associated story permissions
    await storyPermissionService.deletePermissionsBetweenUsers(
      existingFriendship.senderId,
      existingFriendship.receiverId,
    );
    this.notifyChanged(userId, targetUserId);
  }

  async unfriendUser(userId: string, targetUserId: string): Promise<void> {
    await this.checkUserExistence(userId);
    await this.checkUserExistence(targetUserId);

    // Find the FRIEND friendship between userId and targetUserId, regardless of who was sender/receiver
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        or(
          and(eq(friendships.senderId, userId), eq(friendships.receiverId, targetUserId)),
          and(eq(friendships.senderId, targetUserId), eq(friendships.receiverId, userId)),
        ),
        eq(friendships.status, FriendStatus.FRIEND),
      ),
    });

    if (!existingFriendship) {
      throw new AppError(409, 'Users are not friends.');
    }

    await db.delete(friendships).where(eq(friendships.id, existingFriendship.id));

    // After unfriending, delete any associated story permissions
    await storyPermissionService.deletePermissionsBetweenUsers(
      existingFriendship.senderId,
      existingFriendship.receiverId,
    );
    this.notifyChanged(userId, targetUserId);
  }

  async blacklistUser(blisterId: string, blacklistedUserId: string): Promise<Friendship> {
    if (blisterId === blacklistedUserId) {
      throw new AppError(400, 'Cannot blacklist self.');
    }

    await this.checkUserExistence(blisterId);
    await this.checkUserExistence(blacklistedUserId);

    let existingFriendship = await db.query.friendships.findFirst({
      where: or(
        and(eq(friendships.senderId, blisterId), eq(friendships.receiverId, blacklistedUserId)),
        and(eq(friendships.senderId, blacklistedUserId), eq(friendships.receiverId, blisterId)),
      ),
    });

    if (existingFriendship) {
      if (existingFriendship.status === FriendStatus.BLACKLISTED) {
        return existingFriendship;
      }

      const originalStatus = existingFriendship.status;

      // Update existing friendship to blacklisted
      const updatedFriendship = await db
        .update(friendships)
        .set({ status: FriendStatus.BLACKLISTED, blockedById: blisterId, updatedAt: new Date() })
        .where(eq(friendships.id, existingFriendship.id))
        .returning();

      // If the status changed from FRIEND to BLACKLISTED, delete associated story permissions
      if (originalStatus === FriendStatus.FRIEND) {
        await storyPermissionService.deletePermissionsBetweenUsers(
          existingFriendship.senderId,
          existingFriendship.receiverId,
        );
      }
      this.notifyChanged(blisterId, blacklistedUserId);
      return updatedFriendship[0];
    } else {
      // Create new blacklisted friendship
      const newFriendshipData = {
        id: ulid(),
        senderId: blisterId,
        receiverId: blacklistedUserId,
        status: FriendStatus.BLACKLISTED,
        blockedById: blisterId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const newFriendship = await db.insert(friendships).values(newFriendshipData).returning();
      this.notifyChanged(blisterId, blacklistedUserId);
      return newFriendship[0];
    }
  }

  async unblacklistUser(unblisterId: string, unblacklistedUserId: string): Promise<void> {
    if (unblisterId === unblacklistedUserId) {
      throw new AppError(400, 'Cannot unblacklist self.');
    }

    await this.checkUserExistence(unblisterId);
    await this.checkUserExistence(unblacklistedUserId);

    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        or(
          and(
            eq(friendships.senderId, unblisterId),
            eq(friendships.receiverId, unblacklistedUserId),
          ),
          and(
            eq(friendships.senderId, unblacklistedUserId),
            eq(friendships.receiverId, unblisterId),
          ),
        ),
        eq(friendships.status, FriendStatus.BLACKLISTED),
      ),
    });

    if (!existingFriendship) {
      throw new AppError(404, 'User is not blacklisted by you.');
    }

    // Only the user who actually issued the blacklist can undo it - being blocked isn't a
    // privilege to unblock yourself. Rows blacklisted before `blockedById` existed have it
    // `null`; treat those as unblockable by either side (there's no way to recover who
    // blocked whom for them) rather than leaving them permanently stuck.
    if (existingFriendship.blockedById && existingFriendship.blockedById !== unblisterId) {
      throw new AppError(403, 'Only the user who blacklisted this relationship can remove it.');
    }

    await db.delete(friendships).where(eq(friendships.id, existingFriendship.id));
    this.notifyChanged(unblisterId, unblacklistedUserId);
  }

  async cancelSentFriendRequest(senderId: string, targetUserId: string): Promise<void> {
    await this.checkUserExistence(senderId);
    await this.checkUserExistence(targetUserId);

    // Find the pending friendship where senderId is the sender and targetUserId is the receiver
    const existingFriendship = await db.query.friendships.findFirst({
      where: and(
        eq(friendships.senderId, senderId),
        eq(friendships.receiverId, targetUserId),
        eq(friendships.status, FriendStatus.PENDING),
      ),
    });

    if (!existingFriendship) {
      throw new AppError(404, 'Sent friend request not found or not pending.');
    }

    await db.delete(friendships).where(eq(friendships.id, existingFriendship.id));
    this.notifyChanged(senderId, targetUserId);
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
        blockedById: friendships.blockedById,
        createdAt: friendships.createdAt,
        updatedAt: friendships.updatedAt,
        // Corrected: friendUserAlias.username correctly identifies the other user's username due to the join condition.
        friendUsername: friendUserAlias.username,
        otherUserTag: friendUserAlias.tag,
        otherUserAvatarColor: friendUserAlias.avatarColor,
        otherUserAvatarIcon: friendUserAlias.avatarIcon,
        otherUserBio: friendUserAlias.bio,
        // otherUserId is dynamically determined based on which user in the friendship is not the current userId.
        otherUserId: sql<string>`
          CASE
            WHEN ${friendships.senderId} = ${userId} THEN ${friendships.receiverId}
            ELSE ${friendships.senderId}
          END
        `.as('otherUserId'),
      })
      .from(friendships)
      .leftJoin(
        friendUserAlias,
        or(
          and(eq(friendships.senderId, userId), eq(friendships.receiverId, friendUserAlias.id)),
          and(eq(friendships.receiverId, userId), eq(friendships.senderId, friendUserAlias.id)),
        ),
      )
      .where(or(eq(friendships.senderId, userId), eq(friendships.receiverId, userId)));

    const enrichedFriendships: EnrichedFriendship[] = friendshipsData.map((f) => {
      return {
        id: f.id,
        senderId: f.senderId,
        receiverId: f.receiverId,
        status: f.status,
        blockedById: f.blockedById,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        friendUsername: f.friendUsername || '',
        otherUserId: f.otherUserId || '', // Ensure otherUserId is included now that EnrichedFriendship type includes it
        otherUserTag: f.otherUserTag || '',
        otherUserAvatarColor: f.otherUserAvatarColor,
        otherUserAvatarIcon: f.otherUserAvatarIcon,
        otherUserBio: f.otherUserBio,
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
