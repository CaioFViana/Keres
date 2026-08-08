import { and, eq, or } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { friendships, servers } from '../db/schema';
import { createStoryService } from '../services/storymanagement/StoryService';
import { useUserSettingsStore } from '../state/userSettingsStore';

export const useUserDisplayName = (
  logUserId: string,
  storyId: string | undefined,
): string => {
  const { t } = useTranslation();
  const drizzle = useDrizzle();
  const { userId: localUserId, username: currentUsername, activeServer } = useUserSettingsStore();
  const [displayName, setDisplayName] = useState<string>(t('user_not_found'));

  useEffect(() => {
    const resolveUserName = async () => {
      if (!logUserId) {
        setDisplayName(t('user_not_found'));
        return;
      }

      // Offline-only stories record the local installation id (see
      // `getUserIdForOperation`). That id does not exist in the server user table,
      // so resolve it from the settings store before looking at server data.
      if (localUserId && logUserId === localUserId && currentUsername) {
        setDisplayName(`${currentUsername} ${t('you_suffix')}`);
        return;
      }

      if (!drizzle) {
        setDisplayName(t('user_not_found'));
        return;
      }

      // 1. Check if it's the current user (via activeServer.idUser)
      if (activeServer && logUserId === activeServer.idUser) {
        const name = `${activeServer.userName} ${t('you_suffix')}`;
        setDisplayName(name);
        return;
      }

      // 2. Check in friendships
      let storyServerId: string | null = null;
      if (storyId) {
        const storyService = createStoryService(drizzle);
        const story = await storyService.getStoryById(storyId);
        if (story) {
          storyServerId = story.serverId;
        }
      }

      let friendshipQuery;
      if (storyServerId) {
        friendshipQuery = and(
          or(eq(friendships.senderId, logUserId), eq(friendships.receiverId, logUserId)),
          eq(friendships.serverId, storyServerId)
        );
      } else {
        friendshipQuery = or(eq(friendships.senderId, logUserId), eq(friendships.receiverId, logUserId));
      }

      const friend = await drizzle.query.friendships.findFirst({
        where: friendshipQuery,
      });

      if (friend) {
        setDisplayName(friend.friendUsername);
        return;
      }

      // 3. Check in *all* registered servers for users that match the logUserId
      const foundServerUser = await drizzle.query.servers.findFirst({
        where: eq(servers.idUser, logUserId),
      });

      if (foundServerUser) {
        setDisplayName(foundServerUser.userName);
        return;
      }

      // 4. Fallback if not found
      setDisplayName(t('user_not_found'));
    };

    resolveUserName();
  }, [logUserId, storyId, localUserId, currentUsername, activeServer, drizzle, t]);

  return displayName;
};
