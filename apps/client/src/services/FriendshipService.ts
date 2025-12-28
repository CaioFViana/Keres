import { FriendshipInsert, friendships, FriendshipSelect } from '@/src/db/schemas/friendships'; // Import friendships here
import { servers, ServerSelect } from '@/src/db/schemas/servers'; // Import servers schema and ServerSelect
import { users, UserInsert } from '@/src/db/schemas/users'; // Import users schema and UserInsert
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { eq, or, sql } from 'drizzle-orm';
import { AppDrizzleClient, AppDrizzleTransaction } from '../db';
import { createULID } from '../utils/ulid';
import { friendshipApiService } from './FriendshipApiService'; // Import the API service
import { EnrichedFriendship } from '@keres/shared'; // Keep EnrichedFriendship for API interaction
import { NotificationType, useNotificationStore } from '../state/notificationStore'; // Import notification store and types
import { entityEventEmitter } from '../utils/EventEmitter'; // Import entityEventEmitter

export type FriendshipWithServer = FriendshipSelect & {
  serverName: string | null;
  serverUrl: string | null;
};

export const createFriendshipService = (db: AppDrizzleClient) => {
  return new FriendshipService(db);
};

export class FriendshipService {
  constructor(private db: AppDrizzleClient) { }

  async getAllFriendships(): Promise<FriendshipWithServer[]> {
    const result = await this.db.select({
      id: friendships.id,
      serverId: friendships.serverId,
      senderId: friendships.senderId,
      receiverId: friendships.receiverId,
      friendUsername: friendships.friendUsername,
      status: friendships.status,
      createdAt: friendships.createdAt,
      updatedAt: friendships.updatedAt,
      // Add server details
      serverName: servers.name,
      serverUrl: servers.url,
    })
      .from(friendships)
      .leftJoin(servers, eq(friendships.serverId, servers.id))
      .all();
    console.log('FriendshipService - Fetched friendships from DB:', result); // Debug log
    return result;
  }

  async getFriendshipById(id: string): Promise<FriendshipSelect | undefined> { // Changed return type
    const friendship = await this.db.select().from(friendships).where(eq(friendships.id, id)).get();
    return friendship; // No cast needed
  }

  async addFriendship(data: Omit<FriendshipInsert, 'id' | 'createdAt' | 'updatedAt'>): Promise<FriendshipSelect> { // Removed version, isDeleted, deletedAt from Omit
    const newFriendship: FriendshipInsert = {
      id: createULID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    await this.db.insert(friendships).values(newFriendship).run();
    entityEventEmitter.emit('friendship_changed'); // Emit event after adding
    return newFriendship as FriendshipSelect; // Cast for consistency if needed, but should be fine
  }

  async bulkAddFriendships(friendshipData: FriendshipInsert[], tx?: AppDrizzleTransaction): Promise<void> {
    const dbClient = tx || this.db;
    if (friendshipData.length > 0) {
      await dbClient.insert(friendships)
        .values(friendshipData)
        .onConflictDoUpdate({
          target: friendships.id, // Conflict on the primary key 'id'
          set: {
            senderId: sql`excluded.sender_id`,
            receiverId: sql`excluded.receiver_id`,
            friendUsername: sql`excluded.friend_username`,
            status: sql`excluded.status`,
            createdAt: sql`excluded.created_at`,
            updatedAt: sql`excluded.updated_at`,
            serverId: sql`excluded.server_id`,
          },
        })
        .run();
    }
  }

  async updateFriendship(id: string, data: Partial<FriendshipInsert>): Promise<void> {
    await this.db.update(friendships).set({ ...data, updatedAt: new Date() }).where(eq(friendships.id, id)).run();
    entityEventEmitter.emit('friendship_changed'); // Emit event after updating
  }

  async deleteFriendship(id: string): Promise<void> {
    await this.db.delete(friendships).where(eq(friendships.id, id)).run();
    entityEventEmitter.emit('friendship_changed'); // Emit event after deleting
  }

  async clearAllFriendshipsForUser(currentUserId: string): Promise<void> {
    await this.db.delete(friendships)
      .where(or(
        eq(friendships.senderId, currentUserId),
        eq(friendships.receiverId, currentUserId)
      ))
      .run();
    entityEventEmitter.emit('friendship_changed'); // Emit event after clearing
  }

  private async getTargetUserId(friendshipId: string, currentUserId: string): Promise<string> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) {
      throw new Error('Friendship not found.');
    }
    // The target is the user who is not the current user in the friendship
    return friendship.senderId === currentUserId ? friendship.receiverId : friendship.senderId;
  }

  async acceptFriendRequest(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    // Ensure the current user is the receiver of the pending request
    if (friendship.receiverId !== currentUserId || friendship.status !== FriendStatus.PENDING) {
      throw new Error('Not authorized to accept this request or request is not pending.');
    }
    const targetUserId = friendship.senderId; // The sender is the target for acceptance

    await friendshipApiService.acceptFriendRequest(targetUserId);
    await this.updateFriendship(friendshipId, { status: FriendStatus.FRIEND });
    entityEventEmitter.emit('friendship_changed');
  }

  async declineFriendRequest(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    // Ensure the current user is the receiver of the pending request
    if (friendship.receiverId !== currentUserId || friendship.status !== FriendStatus.PENDING) {
      throw new Error('Not authorized to decline this request or request is not pending.');
    }
    const targetUserId = friendship.senderId; // The sender is the target for declining

    await friendshipApiService.declineFriendRequest(targetUserId);
    await this.deleteFriendship(friendshipId);
    entityEventEmitter.emit('friendship_changed');
  }

  async cancelSentFriendRequest(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    // Ensure the current user is the sender of the pending request
    if (friendship.senderId !== currentUserId || friendship.status !== FriendStatus.PENDING) {
      throw new Error('Not authorized to cancel this request or request is not pending.');
    }
    const targetUserId = friendship.receiverId; // The receiver is the target for canceling

    await friendshipApiService.cancelSentFriendRequest(targetUserId);
    await this.deleteFriendship(friendshipId);
    entityEventEmitter.emit('friendship_changed');
  }

  async unfriendUser(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    // Ensure both users are friends
    if (friendship.status !== FriendStatus.FRIEND) {
      throw new Error('Users are not friends.');
    }
    const targetUserId = await this.getTargetUserId(friendshipId, currentUserId);

    await friendshipApiService.unfriendUser(targetUserId);
    await this.deleteFriendship(friendshipId);
    entityEventEmitter.emit('friendship_changed');
  }

  async blacklistUser(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    const targetUserId = await this.getTargetUserId(friendshipId, currentUserId);

    await friendshipApiService.blacklistUser(targetUserId);
    // If the friendship exists, update its status. If not, the API will create a new blacklisted entry.
    // The sync process will reconcile if a new entry is created on the server.
    await this.updateFriendship(friendshipId, { status: FriendStatus.BLACKLISTED });
    entityEventEmitter.emit('friendship_changed');
  }

  async unblacklistUser(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    // Ensure the friendship is blacklisted
    if (friendship.status !== FriendStatus.BLACKLISTED) {
      throw new Error('User is not blacklisted.');
    }
    const targetUserId = await this.getTargetUserId(friendshipId, currentUserId);

    await friendshipApiService.unblacklistUser(targetUserId);
    await this.deleteFriendship(friendshipId); // Blacklisted friendships are deleted upon unblacklist locally
    entityEventEmitter.emit('friendship_changed');
  }

  private async ensureUsersExist(userIds: string[], serverId: string, tx?: AppDrizzleTransaction): Promise<void> {
    const dbClient = tx || this.db;
    if (userIds.length === 0) {
      return;
    }

    const uniqueUserIds = Array.from(new Set(userIds));
    const existingUsers = await dbClient.select({ idUser: users.idUser }).from(users).where(or(...uniqueUserIds.map(id => eq(users.idUser, id)))).all();
    const existingUserIdSet = new Set(existingUsers.map(u => u.idUser));

    const usersToInsert: UserInsert[] = [];
    const now = new Date();

    for (const userId of uniqueUserIds) {
      if (!existingUserIdSet.has(userId)) {
        usersToInsert.push({
          idUser: userId,
          idServer: serverId, // Use the serverId of the friendship
          displayName: `User_${userId.substring(0, 8)}`, // Placeholder display name
          createdAt: now,
          updatedAt: now,
          version: 1, // Default version
          isDeleted: false,
          deletedAt: null,
        });
      }
    }

    if (usersToInsert.length > 0) {
      console.log(`Inserting ${usersToInsert.length} placeholder users into local DB.`);
      await dbClient.insert(users).values(usersToInsert).onConflictDoNothing().run();
    }
  }

  async syncFriendshipsWithServer(currentUserId: string, serverId: string): Promise<void> {
    try {
      await this.db.transaction(async (tx: AppDrizzleTransaction) => {
        const serverFriendships: EnrichedFriendship[] = await friendshipApiService.getFriendships();
        const showNotification = useNotificationStore.getState().showNotification;

        // --- Notification Preparation & Deletion Logic ---
        const previousLocalFriendshipMap = new Map<string, FriendshipSelect>();
        const localFriendshipsBeforeSync = await tx.select().from(friendships).all(); 
        localFriendshipsBeforeSync.forEach(f => previousLocalFriendshipMap.set(f.id, f));

        const serverFriendshipIds = new Set(serverFriendships.map(sf => sf.id));

        const friendshipsToDelete = localFriendshipsBeforeSync.filter(
          localF => !serverFriendshipIds.has(localF.id)
        );

        if (friendshipsToDelete.length > 0) {
          for (const friendship of friendshipsToDelete) {
            await tx.delete(friendships).where(eq(friendships.id, friendship.id)).run();
          }
        }

        // --- Ensure all users referenced in friendships exist locally ---
        const allFriendshipUserIds: string[] = [];
        serverFriendships.forEach(sf => {
          allFriendshipUserIds.push(sf.senderId);
          allFriendshipUserIds.push(sf.receiverId);
        });
        await this.ensureUsersExist(allFriendshipUserIds, serverId, tx);

        // --- Insertion/Update Logic (with Notification Detection) ---
        const friendshipsToInsertOrUpdate: FriendshipInsert[] = [];
        for (const sf of serverFriendships) {
          const previousStatus = previousLocalFriendshipMap.get(sf.id)?.status;

          const friendshipInsert: FriendshipInsert = {
            id: sf.id,
            senderId: sf.senderId,
            receiverId: sf.receiverId,
            friendUsername: sf.friendUsername,
            status: sf.status,
            createdAt: new Date(sf.createdAt),
            updatedAt: new Date(sf.updatedAt),
            serverId: serverId,
          };
          friendshipsToInsertOrUpdate.push(friendshipInsert);

          // Notification logic
          if (!previousStatus && sf.status === FriendStatus.PENDING) {
            showNotification(`New friend request from ${sf.friendUsername}`, 'info');
          } else if (previousStatus === FriendStatus.PENDING && sf.status === FriendStatus.FRIEND) {
            showNotification(`Friend request from ${sf.friendUsername} accepted!`, 'success');
          }
        }

        if (friendshipsToInsertOrUpdate.length > 0) {
          await this.bulkAddFriendships(friendshipsToInsertOrUpdate, tx); // bulkAddFriendships now emits event
        }
      });

      entityEventEmitter.emit('friendship_changed'); // Emit event after sync to notify of potential changes
    } catch (error) {
      console.error('FriendshipService: Error syncing friendships with server:', error);
      throw error;
    }
  }
}
