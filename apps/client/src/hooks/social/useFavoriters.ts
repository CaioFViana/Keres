import type { FavoriteEntityType } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { servers, stories } from '@/src/db/schema';
import { createFavoriteService } from '@/src/services/storymanagement/notes-tags-comments/FavoriteService';
import {
  type EntityEventSubscription,
  useEntityEventSubscriptions,
} from '@/src/hooks/lists/useEntityRefreshLifecycle';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';
import type { ResolvedUserProfile } from './useUserProfileResolver';
import { useUserProfileResolver } from './useUserProfileResolver';

type Roster = { isPublic: boolean; profiles: ResolvedUserProfile[] };

const HIDDEN: Roster = { isPublic: false, profiles: [] };

/** Public-favorite roster for one entity. Hidden when the story does not publish who starred it. */
export function useFavoriters(storyId: string, entityId: string, entityType: FavoriteEntityType) {
  const db = useDrizzle();
  const resolveProfile = useUserProfileResolver();

  const load = useMemo(
    () => async (): Promise<Roster> => {
      const favoriteService = createFavoriteService(db);
      const behavior = await favoriteService.getBehavior(storyId);
      if (behavior !== 'individual_public') return HIDDEN;

      const story = await db.query.stories.findFirst({
        where: eq(stories.id, storyId),
        columns: { serverId: true },
      });
      const storyServer = story?.serverId
        ? await db.query.servers.findFirst({ where: eq(servers.id, story.serverId) })
        : undefined;
      const userIds = await favoriteService.getFavoriterIds(storyId, entityId, entityType);
      const profiles = await Promise.all(
        userIds.map((userId) => resolveProfile(userId, storyServer)),
      );
      profiles.sort(
        (a, b) => Number(b.isCurrentUser) - Number(a.isCurrentUser) || a.name.localeCompare(b.name),
      );
      return { isPublic: true, profiles };
    },
    [db, entityId, entityType, resolveProfile, storyId],
  );
  const { data, loading, reload } = useLoadedResource({
    load,
    initial: HIDDEN,
    label: 'the users who favorited the entity',
  });

  const subscriptions = useMemo<EntityEventSubscription[]>(
    () => [
      {
        event: 'favorite_changed',
        listener: (
          changedStoryId: string,
          changedEntityType: FavoriteEntityType,
          changedEntityId: string,
        ) => {
          if (
            changedStoryId === storyId &&
            changedEntityType === entityType &&
            changedEntityId === entityId
          ) {
            void reload();
          }
        },
      },
      {
        event: 'story_changed',
        listener: (changedStoryId: string) => {
          if (changedStoryId === storyId) void reload();
        },
      },
      { event: 'friendship_changed', listener: () => void reload() },
    ],
    [entityId, entityType, reload, storyId],
  );
  useEntityEventSubscriptions(subscriptions);

  return { isPublic: data.isPublic, profiles: data.profiles, loading };
}
