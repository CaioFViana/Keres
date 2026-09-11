import type { FavoriteEntityType } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { useCallback, useEffect, useState } from 'react';
import { useDrizzle } from '../db';
import { servers, stories } from '../db/schema';
import { createFavoriteService } from '../services/storymanagement/FavoriteService';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useEntityInitialLoad } from './useEntityRefreshLifecycle';
import type { ResolvedUserProfile } from './useUserProfileResolver';
import { useUserProfileResolver } from './useUserProfileResolver';

/** Public-favorite roster for one entity. Hidden when the story does not publish who starred it. */
export function useFavoriters(storyId: string, entityId: string, entityType: FavoriteEntityType) {
  const db = useDrizzle();
  const resolveProfile = useUserProfileResolver();
  const [isPublic, setIsPublic] = useState(false);
  const [profiles, setProfiles] = useState<ResolvedUserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavoriters = useCallback(async () => {
    setLoading(true);
    try {
      const favoriteService = createFavoriteService(db);
      const behavior = await favoriteService.getBehavior(storyId);
      if (behavior !== 'individual_public') {
        setIsPublic(false);
        setProfiles([]);
        return;
      }

      setIsPublic(true);
      const story = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
        columns: { serverId: true },
      });
      const storyServer = story?.serverId
        ? await db.query.servers.findFirst({ where: eq(servers.id, story.serverId) })
        : undefined;
      const userIds = await favoriteService.getFavoriterIds(storyId, entityId, entityType);
      const resolved = await Promise.all(
        userIds.map((userId) => resolveProfile(userId, storyServer)),
      );
      resolved.sort(
        (a, b) => Number(b.isCurrentUser) - Number(a.isCurrentUser) || a.name.localeCompare(b.name),
      );
      setProfiles(resolved);
    } catch (error) {
      console.error('Failed to load users who favorited the entity:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [db, entityId, entityType, resolveProfile, storyId]);

  useEntityInitialLoad(fetchFavoriters);

  useEffect(() => {
    const handleFavoriteChange = (
      changedStoryId: string,
      changedEntityType: FavoriteEntityType,
      changedEntityId: string,
    ) => {
      if (
        changedStoryId === storyId &&
        changedEntityType === entityType &&
        changedEntityId === entityId
      ) {
        fetchFavoriters();
      }
    };
    const handleStoryChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) fetchFavoriters();
    };
    const handleFriendshipChange = () => {
      fetchFavoriters();
    };
    entityEventEmitter.on('favorite_changed', handleFavoriteChange);
    entityEventEmitter.on('story_changed', handleStoryChange);
    entityEventEmitter.on('friendship_changed', handleFriendshipChange);
    return () => {
      entityEventEmitter.off('favorite_changed', handleFavoriteChange);
      entityEventEmitter.off('story_changed', handleStoryChange);
      entityEventEmitter.off('friendship_changed', handleFriendshipChange);
    };
  }, [entityId, entityType, fetchFavoriters, storyId]);

  return { isPublic, profiles, loading };
}
