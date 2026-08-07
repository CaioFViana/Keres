import {
  UserTargetIdParam,
} from '@keres/shared/schemas/FriendshipRouteSchemas';
import { Elysia } from 'elysia';
import { JWTPayload } from '../../index';
import { friendshipService } from '../../services/FriendshipService';

export const friendRoutes = new Elysia()
  .decorate('user', null as JWTPayload | null)
  .post(
    '/request/:targetUserId',
    async ({ params, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      return friendshipService.sendFriendRequest(
        user.userId,
        params.targetUserId
      );
    },
    {
      params: UserTargetIdParam,
      detail: {
        summary: 'Send a friend request',
        description: 'Sends a friend request to another user.',
        tags: ['Friendships'],
      },
    }
  )
  .put(
    '/accept/:targetUserId',
    async ({ params, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      return friendshipService.acceptFriendRequest(
        user.userId,
        params.targetUserId
      );
    },
    {
      params: UserTargetIdParam,
      detail: {
        summary: 'Accept a friend request',
        description: 'Accepts a pending friend request from another user.',
        tags: ['Friendships'],
      },
    }
  )
  .delete(
    '/decline/:targetUserId',
    async ({ params, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      return friendshipService.declineFriendRequest(
        user.userId,
        params.targetUserId
      );
    },
    {
      params: UserTargetIdParam,
      detail: {
        summary: 'Decline a friend request',
        description: 'Declines a pending friend request received from another user.',
        tags: ['Friendships'],
      },
    }
  )
  .delete(
    '/request/:targetUserId',
    async ({ params, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      return friendshipService.cancelSentFriendRequest(
        user.userId,
        params.targetUserId
      );
    },
    {
      params: UserTargetIdParam,
      detail: {
        summary: 'Cancel a sent friend request',
        description: 'Cancels a friend request previously sent to another user.',
        tags: ['Friendships'],
      },
    }
  )
  .post(
    '/blacklist/:targetUserId',
    async ({ params, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      return friendshipService.blacklistUser(
        user.userId,
        params.targetUserId
      );
    },
    {
      params: UserTargetIdParam,
      detail: {
        summary: 'Blacklist a user',
        description: 'Blacklists another user, preventing them from sending friend requests or interacting.',
        tags: ['Friendships'],
      },
    }
  )
  .delete(
    '/blacklist/:targetUserId',
    async ({ params, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      return friendshipService.unblacklistUser(
        user.userId,
        params.targetUserId
      );
    },
    {
      params: UserTargetIdParam,
      detail: {
        summary: 'Unblacklist a user',
        description: 'Removes a user from the blacklist, allowing future interaction or friend requests.',
        tags: ['Friendships'],
      },
    }
  )
  .delete(
    '/unfriend/:targetUserId',
    async ({ params, user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      return friendshipService.unfriendUser(
        user.userId,
        params.targetUserId
      );
    },
    {
      params: UserTargetIdParam,
      detail: {
        summary: 'Unfriend a user',
        description: 'Removes a user from your friends list.',
        tags: ['Friendships'],
      },
    }
  )
  .get(
    '/',
    async ({ user, set }) => {
      if (!user || !user.userId) {
        set.status = 401;
        throw new Error('Unauthorized: User not authenticated.');
      }
      return friendshipService.getFriendships(user.userId);
    },
    {
      detail: {
        summary: 'Get all friendships',
        description: 'Retrieves all friendship relations (pending, friends, blacklisted) for the authenticated user.',
        tags: ['Friendships'],
      },
    }
  );