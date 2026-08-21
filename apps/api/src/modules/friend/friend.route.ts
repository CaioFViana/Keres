import { UserTargetIdParam } from '@keres/shared/schemas/FriendshipRouteSchemas';
import { Elysia, t } from 'elysia';
import { JWTPayload } from '../../index';
import { friendshipService } from '../../services/FriendshipService';

/** A `friendships` row exactly as `.returning()`/`db.query` sends it back - `createdAt`/
 *  `updatedAt` are raw Date instances here (unlike EnrichedFriendshipResponseSchema below,
 *  where FriendshipService.getFriendships explicitly calls `.toISOString()` on them). */
const FriendshipResponseSchema = t.Object({
  id: t.String(),
  senderId: t.String(),
  receiverId: t.String(),
  status: t.String(),
  blockedById: t.Nullable(t.String()),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

const EnrichedFriendshipResponseSchema = t.Object({
  id: t.String(),
  senderId: t.String(),
  receiverId: t.String(),
  status: t.String(),
  blockedById: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
  friendUsername: t.String(),
  otherUserId: t.String(),
  otherUserTag: t.String(),
  otherUserAvatarColor: t.Nullable(t.String()),
  otherUserAvatarIcon: t.Nullable(t.String()),
  otherUserBio: t.Nullable(t.String()),
});

export const friendRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  // Every route in this file requires the same thing - an authenticated user - unlike
  // media.route.ts's `requirePermission`, which varies per route (reader vs writer). A single
  // eager derive replaces the identical `if (!user) { 401 }` block that used to open all 8
  // handlers, and lets each of them use `userId` directly instead of re-deriving it from `user`.
  .derive(({ user, set }) => {
    if (!user?.userId) {
      set.status = 401;
      throw new Error('Unauthorized: User not authenticated.');
    }
    return { userId: user.userId };
  })
  .post(
    '/request/:targetUserId',
    async ({ params, userId }) => friendshipService.sendFriendRequest(userId, params.targetUserId),
    {
      params: UserTargetIdParam,
      response: FriendshipResponseSchema,
      detail: {
        summary: 'Send a friend request',
        description: 'Sends a friend request to another user.',
        tags: ['Friendships'],
      },
    },
  )
  .put(
    '/accept/:targetUserId',
    async ({ params, userId }) =>
      friendshipService.acceptFriendRequest(userId, params.targetUserId),
    {
      params: UserTargetIdParam,
      response: FriendshipResponseSchema,
      detail: {
        summary: 'Accept a friend request',
        description: 'Accepts a pending friend request from another user.',
        tags: ['Friendships'],
      },
    },
  )
  .delete(
    '/decline/:targetUserId',
    async ({ params, userId }) =>
      friendshipService.declineFriendRequest(userId, params.targetUserId),
    {
      params: UserTargetIdParam,
      response: t.Void(),
      detail: {
        summary: 'Decline a friend request',
        description: 'Declines a pending friend request received from another user.',
        tags: ['Friendships'],
      },
    },
  )
  .delete(
    '/request/:targetUserId',
    async ({ params, userId }) =>
      friendshipService.cancelSentFriendRequest(userId, params.targetUserId),
    {
      params: UserTargetIdParam,
      response: t.Void(),
      detail: {
        summary: 'Cancel a sent friend request',
        description: 'Cancels a friend request previously sent to another user.',
        tags: ['Friendships'],
      },
    },
  )
  .post(
    '/blacklist/:targetUserId',
    async ({ params, userId }) => friendshipService.blacklistUser(userId, params.targetUserId),
    {
      params: UserTargetIdParam,
      response: FriendshipResponseSchema,
      detail: {
        summary: 'Blacklist a user',
        description:
          'Blacklists another user, preventing them from sending friend requests or interacting.',
        tags: ['Friendships'],
      },
    },
  )
  .delete(
    '/blacklist/:targetUserId',
    async ({ params, userId }) => friendshipService.unblacklistUser(userId, params.targetUserId),
    {
      params: UserTargetIdParam,
      response: t.Void(),
      detail: {
        summary: 'Unblacklist a user',
        description:
          'Removes a user from the blacklist, allowing future interaction or friend requests.',
        tags: ['Friendships'],
      },
    },
  )
  .delete(
    '/unfriend/:targetUserId',
    async ({ params, userId }) => friendshipService.unfriendUser(userId, params.targetUserId),
    {
      params: UserTargetIdParam,
      response: t.Void(),
      detail: {
        summary: 'Unfriend a user',
        description: 'Removes a user from your friends list.',
        tags: ['Friendships'],
      },
    },
  )
  .get('/', async ({ userId }) => friendshipService.getFriendships(userId), {
    response: t.Array(EnrichedFriendshipResponseSchema),
    detail: {
      summary: 'Get all friendships',
      description:
        'Retrieves all friendship relations (pending, friends, blacklisted) for the authenticated user.',
      tags: ['Friendships'],
    },
  });
