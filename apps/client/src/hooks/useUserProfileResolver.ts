import { eq } from 'drizzle-orm';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import type { ServerSelect } from '../db/schema';
import { users } from '../db/schema';
import { friendshipApiService } from '../services/FriendshipApiService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { entityEventEmitter } from '../utils/EventEmitter';

export interface ResolvedUserProfile {
  id: string;
  name: string;
  avatarColor?: string | null;
  avatarIcon?: string | null;
  isCurrentUser: boolean;
}

/**
 * Shared across every instance of the hook (not per component) - the same cache
 * `FavoritedByList` kept privately before this extraction.
 */
const remoteProfileCache = new Map<string, Promise<ResolvedUserProfile | undefined>>();

/**
 * Resolves a `userId`'s profile (name + avatar), preferring the local user cache
 * (kept up to date by the friendship synchronization) and falling back to a network lookup
 * cached per server when necessary. Extracted from `FavoritedByList` so it can be
 * reused by anywhere that needs to show "who did X" with a name+avatar
 * (comments, for instance) without duplicating that logic.
 *
 * It returns the resolver function (not an already-resolved profile) because consumers
 * typically resolve several profiles per render through `Promise.all`, not just one.
 */
export function useUserProfileResolver() {
  const db = useDrizzle();
  const { t } = useTranslation();
  const { userId: localUserId, username: localUsername } = useUserSettingsStore();

  const resolveProfile = useCallback(
    async (userId: string, storyServer: ServerSelect | undefined): Promise<ResolvedUserProfile> => {
      const isCurrentUser =
        (!storyServer && userId === localUserId) || storyServer?.idUser === userId;
      // Friendship sync keeps this local user row enriched with the friend's current name,
      // icon and color. Prefer it over the network cache so a realtime refresh is immediately
      // reflected by every consumer already mounted.
      const localProfile = await db.query.users.findFirst({
        where: eq(users.idUser, userId),
        columns: { displayName: true, avatarColor: true, avatarIcon: true },
      });
      if (localProfile) {
        return {
          id: userId,
          name:
            localProfile.displayName ||
            (isCurrentUser ? storyServer?.userName || localUsername : undefined) ||
            t('user_not_found'),
          avatarColor: localProfile.avatarColor,
          avatarIcon: localProfile.avatarIcon,
          isCurrentUser,
        };
      }

      if (!storyServer && isCurrentUser) {
        return { id: userId, name: localUsername || t('user_not_found'), isCurrentUser: true };
      }

      if (storyServer) {
        const cacheKey = `${storyServer.id}:${userId}`;
        let request = remoteProfileCache.get(cacheKey);
        if (!request) {
          request = friendshipApiService
            .getUserDetails(storyServer, userId)
            .then((user) =>
              user
                ? {
                    id: user.id,
                    name: user.username,
                    avatarColor: user.avatarColor,
                    avatarIcon: user.avatarIcon,
                    isCurrentUser: false,
                  }
                : undefined,
            )
            .catch(() => {
              remoteProfileCache.delete(cacheKey);
              return undefined;
            });
          remoteProfileCache.set(cacheKey, request);
        }
        const remoteProfile = await request;
        if (remoteProfile) return { ...remoteProfile, isCurrentUser };
      }

      return { id: userId, name: userId, isCurrentUser };
    },
    [db, localUserId, localUsername, t],
  );

  // It only invalidates the shared cache - whoever wants to re-fetch profiles already displayed needs
  // their own `friendship_changed` listener calling their own refetch (see
  // FavoritedByList, which keeps its own even after this extraction).
  useEffect(() => {
    const handleFriendshipChange = () => remoteProfileCache.clear();
    entityEventEmitter.on('friendship_changed', handleFriendshipChange);
    return () => {
      entityEventEmitter.off('friendship_changed', handleFriendshipChange);
    };
  }, []);

  return resolveProfile;
}
