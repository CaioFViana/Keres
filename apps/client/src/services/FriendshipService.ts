import { FriendshipInsert, friendships, FriendshipSelect } from '@/src/db/schemas/friendships'; // Import friendships here
import { servers, ServerSelect } from '@/src/db/schemas/servers'; // Import servers schema and ServerSelect
import { UserInsert, users } from '@/src/db/schemas/users'; // Import users schema and UserInsert
import { EnrichedFriendship } from '@keres/shared'; // Keep EnrichedFriendship for API interaction
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { eq, inArray, sql } from 'drizzle-orm';
import { AppDrizzleClient, AppDrizzleTransaction } from '../db';
import { useNotificationStore } from '../state/notificationStore'; // Import notification store and types
import { createULID } from '../utils/entityUtils';
import { entityEventEmitter } from '../utils/EventEmitter'; // Import entityEventEmitter
import { isOfflineError } from './apiClient';
import { friendshipApiService } from './FriendshipApiService'; // Import the API service

export type FriendshipWithServer = FriendshipSelect & {
  serverName: string | null;
  serverUrl: string | null;
  /** The "other side" of the friendship - senderId or receiverId, whichever isn't this device's own user id on that server. */
  otherUserId: string;
  otherUserTag: string | null;
  otherUserAvatarColor: string | null;
  otherUserAvatarIcon: string | null;
  otherUserBio: string | null;
};

export const createFriendshipService = (db: AppDrizzleClient) => {
  return new FriendshipService(db);
};

export class FriendshipService {
  constructor(private db: AppDrizzleClient) { }

  async getAllFriendships(): Promise<FriendshipWithServer[]> {
    const rows = await this.db.select({
      id: friendships.id,
      serverId: friendships.serverId,
      senderId: friendships.senderId,
      receiverId: friendships.receiverId,
      friendUsername: friendships.friendUsername,
      status: friendships.status,
      blockedById: friendships.blockedById,
      createdAt: friendships.createdAt,
      updatedAt: friendships.updatedAt,
      // Add server details
      serverName: servers.name,
      serverUrl: servers.url,
      serverOwnUserId: servers.idUser,
    })
      .from(friendships)
      .leftJoin(servers, eq(friendships.serverId, servers.id))
      .all();

    const otherUserIds = rows.map((f) => (f.senderId === f.serverOwnUserId ? f.receiverId : f.senderId));
    const uniqueOtherUserIds = Array.from(new Set(otherUserIds));
    const profileRows = uniqueOtherUserIds.length > 0
      ? await this.db.select({
          idUser: users.idUser,
          tag: users.tag,
          avatarColor: users.avatarColor,
          avatarIcon: users.avatarIcon,
          bio: users.bio,
        }).from(users).where(inArray(users.idUser, uniqueOtherUserIds)).all()
      : [];
    const profileByUserId = new Map(profileRows.map((p) => [p.idUser, p]));

    const result: FriendshipWithServer[] = rows.map((f, index) => {
      const { serverOwnUserId: _serverOwnUserId, ...friendship } = f;
      const otherUserId = otherUserIds[index];
      const profile = profileByUserId.get(otherUserId);
      return {
        ...friendship,
        otherUserId,
        otherUserTag: profile?.tag ?? null,
        otherUserAvatarColor: profile?.avatarColor ?? null,
        otherUserAvatarIcon: profile?.avatarIcon ?? null,
        otherUserBio: profile?.bio ?? null,
      };
    });
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
            blockedById: sql`excluded.blocked_by_id`,
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

  private async getTargetUserId(friendshipId: string, currentUserId: string): Promise<string> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) {
      throw new Error('Friendship not found.');
    }
    // The target is the user who is not the current user in the friendship
    return friendship.senderId === currentUserId ? friendship.receiverId : friendship.senderId;
  }

  // Every friendship action call must go out to the specific server that friendship
  // belongs to - not whichever server the shared apiClient last happened to point at
  // (see FriendshipApiService, which requires an explicit ServerSelect for this reason).
  private async getServerOrThrow(serverId: string): Promise<ServerSelect> {
    const server = await this.db.query.servers.findFirst({ where: eq(servers.id, serverId) });
    if (!server) {
      throw new Error('Server not found for this friendship.');
    }
    return server;
  }

  async acceptFriendRequest(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    // Ensure the current user is the receiver of the pending request
    if (friendship.receiverId !== currentUserId || friendship.status !== FriendStatus.PENDING) {
      throw new Error('Not authorized to accept this request or request is not pending.');
    }
    const targetUserId = friendship.senderId; // The sender is the target for acceptance
    const server = await this.getServerOrThrow(friendship.serverId);

    await friendshipApiService.acceptFriendRequest(server, targetUserId);
    // `updateFriendship` already emits 'friendship_changed' - a second emit here just made
    // every listener (FriendDetailScreen's `load`, in particular) run redundantly for every
    // single action, which is how a single tap could trigger multiple concurrent `goBack()`
    // calls (see unblacklistUser below for where that actually crashed).
    await this.updateFriendship(friendshipId, { status: FriendStatus.FRIEND });
  }

  async declineFriendRequest(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    // Ensure the current user is the receiver of the pending request
    if (friendship.receiverId !== currentUserId || friendship.status !== FriendStatus.PENDING) {
      throw new Error('Not authorized to decline this request or request is not pending.');
    }
    const targetUserId = friendship.senderId; // The sender is the target for declining
    const server = await this.getServerOrThrow(friendship.serverId);

    await friendshipApiService.declineFriendRequest(server, targetUserId);
    await this.deleteFriendship(friendshipId); // Already emits 'friendship_changed'.
  }

  async cancelSentFriendRequest(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    // Ensure the current user is the sender of the pending request
    if (friendship.senderId !== currentUserId || friendship.status !== FriendStatus.PENDING) {
      throw new Error('Not authorized to cancel this request or request is not pending.');
    }
    const targetUserId = friendship.receiverId; // The receiver is the target for canceling
    const server = await this.getServerOrThrow(friendship.serverId);

    await friendshipApiService.cancelSentFriendRequest(server, targetUserId);
    await this.deleteFriendship(friendshipId); // Already emits 'friendship_changed'.
  }

  async unfriendUser(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    // Ensure both users are friends
    if (friendship.status !== FriendStatus.FRIEND) {
      throw new Error('Users are not friends.');
    }
    const targetUserId = await this.getTargetUserId(friendshipId, currentUserId);
    const server = await this.getServerOrThrow(friendship.serverId);

    await friendshipApiService.unfriendUser(server, targetUserId);
    await this.deleteFriendship(friendshipId); // Already emits 'friendship_changed'.
  }

  async blacklistUser(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    const targetUserId = await this.getTargetUserId(friendshipId, currentUserId);
    const server = await this.getServerOrThrow(friendship.serverId);

    // If the friendship exists, update its status. If not, the API will create a new blacklisted entry.
    // The sync process will reconcile if a new entry is created on the server.
    const updated = await friendshipApiService.blacklistUser(server, targetUserId);
    // `blockedById` comes from the server's response, not assumed to be `currentUserId` -
    // the server is the source of truth for who it recorded as the blocker.
    await this.updateFriendship(friendshipId, { status: FriendStatus.BLACKLISTED, blockedById: updated.blockedById });
  }

  async unblacklistUser(friendshipId: string, currentUserId: string): Promise<void> {
    const friendship = await this.getFriendshipById(friendshipId);
    if (!friendship) throw new Error('Friendship not found.');
    // Ensure the friendship is blacklisted
    if (friendship.status !== FriendStatus.BLACKLISTED) {
      throw new Error('User is not blacklisted.');
    }
    // Mirrors the server-side check in FriendshipService.unblacklistUser: only whoever
    // issued the blacklist can undo it. Caught here too (not just hidden in the UI) so a
    // stale/out-of-sync local copy can't let the blocked user slip a request through -
    // the server still has the final say, this just fails fast without a round-trip.
    if (friendship.blockedById && friendship.blockedById !== currentUserId) {
      throw new Error('Only the user who blacklisted this relationship can remove it.');
    }
    const targetUserId = await this.getTargetUserId(friendshipId, currentUserId);
    const server = await this.getServerOrThrow(friendship.serverId);

    await friendshipApiService.unblacklistUser(server, targetUserId);
    await this.deleteFriendship(friendshipId); // Blacklisted friendships are deleted upon unblacklist locally; already emits 'friendship_changed'.
  }

  /**
   * Upserts a local `users` row for every "other side" of a friendship, using the profile
   * data the server already sent along on `EnrichedFriendship` (`friendUsername`/
   * `otherUser*`) - not a placeholder. Replaces the old `ensureUsersExist`, which only
   * inserted a fake `User_<id8>` name for users not yet known locally and then never
   * refreshed it - a friend who set a real display name, avatar, or bio later would stay
   * stuck on the placeholder forever. Every sync now keeps the local copy current instead.
   */
  private async upsertUsersFromFriendships(serverFriendships: EnrichedFriendship[], serverId: string, tx?: AppDrizzleTransaction): Promise<void> {
    const dbClient = tx || this.db;
    if (serverFriendships.length === 0) {
      return;
    }

    const now = new Date();
    // A user can appear in more than one friendship row in the same batch - key by id so
    // each user gets a single upsert with the freshest data seen.
    const usersById = new Map<string, UserInsert>();
    for (const sf of serverFriendships) {
      usersById.set(sf.otherUserId, {
        idUser: sf.otherUserId,
        idServer: serverId,
        displayName: sf.friendUsername,
        tag: sf.otherUserTag,
        avatarColor: sf.otherUserAvatarColor,
        avatarIcon: sf.otherUserAvatarIcon,
        bio: sf.otherUserBio,
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
        deletedAt: null,
      });
    }

    await dbClient.insert(users).values(Array.from(usersById.values()))
      .onConflictDoUpdate({
        target: users.idUser,
        set: {
          displayName: sql`excluded.display_name`,
          tag: sql`excluded.tag`,
          avatarColor: sql`excluded.avatar_color`,
          avatarIcon: sql`excluded.avatar_icon`,
          bio: sql`excluded.bio`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .run();
  }

  async syncFriendshipsWithServer(currentUserId: string, server: ServerSelect): Promise<void> {
    const serverId = server.id;
    // Fetch before opening the transaction: a network round-trip inside a DB
    // transaction holds it open for the whole request and aborts it on failure.
    let serverFriendships: EnrichedFriendship[];
    try {
      serverFriendships = await friendshipApiService.getFriendships(server);
    } catch (error) {
      if (isOfflineError(error)) {
        // Expected while the server is unreachable - keep local friendships as-is.
        console.log('FriendshipService: server unreachable, skipping friendship sync.');
        return;
      }
      throw error;
    }

    try {
      await this.db.transaction(async (tx: AppDrizzleTransaction) => {
        const showNotification = useNotificationStore.getState().showNotification;

        // --- Notification Preparation & Deletion Logic ---
        // Scoped to this server only: serverFriendships below only ever contains rows
        // from `server`, so diffing against every locally-stored friendship (including
        // other servers') would delete other servers' friendships on every sync cycle.
        const previousLocalFriendshipMap = new Map<string, FriendshipSelect>();
        const localFriendshipsBeforeSync = await tx.select().from(friendships).where(eq(friendships.serverId, serverId)).all();
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

        // --- Keep local user profiles (name/avatar/bio) in sync with the server ---
        await this.upsertUsersFromFriendships(serverFriendships, serverId, tx);

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
            blockedById: sf.blockedById,
            createdAt: new Date(sf.createdAt),
            updatedAt: new Date(sf.updatedAt),
            serverId: serverId,
          };
          friendshipsToInsertOrUpdate.push(friendshipInsert);

          // Notification logic
          if (!previousStatus && sf.status === FriendStatus.PENDING && sf.receiverId === currentUserId) { // Only notify receiver
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
      console.log('FriendshipService: Error syncing friendships with server:', (error as Error)?.message || error);
      throw error;
    }
  }
}
