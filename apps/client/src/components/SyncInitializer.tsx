import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createStoryService, useDrizzle } from '../db';
import { createFriendshipService } from '../services/FriendshipService';
import { createServerService } from '../services/ServerService';
import { setAuthDb } from '../services/AuthTokenManager';
import { ServerStoryPreview, SyncEngineService } from '../services/SyncEngineService';
import { useNotificationStore } from '../state/notificationStore';
import { useStoryListStore } from '../state/storyListStore';
import { useUserSettingsStore } from '../state/userSettingsStore';

interface SyncInitializerProps {
  children: React.ReactNode;
}

const SyncInitializer: React.FC<SyncInitializerProps> = ({ children }) => {
  const drizzleClient = useDrizzle();
  const storyService = useRef(createStoryService(drizzleClient)).current;
  const friendshipService = useRef(createFriendshipService(drizzleClient)).current;
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const { fetchStories: fetchStoryList } = useStoryListStore();
  const { t } = useTranslation();

  const syncStoriesWithServers = useCallback(async () => {
    if (!drizzleClient || !userId) {
      console.warn('Drizzle client or userId not available for sync. Skipping.');
      return;
    }

    SyncEngineService.getInstance().setDbInstance(drizzleClient);
    setAuthDb(drizzleClient);

    const serverService = createServerService(drizzleClient);
    const localStories = await storyService.getAllStories();
    const servers = await serverService.getAllServers();

    for (let server of servers) {
      if (!server.url) {
        console.warn(`Server ${server.name} has no URL configured. Skipping.`);
        continue;
      }

      console.log(`Checking server ${server.name} at ${server.url} for new stories...`);
      try {
        server = await serverService.refreshServerToken(server);
        await friendshipService.syncFriendshipsWithServer(server.id, server.url); // Call friendship sync

        const serverStoryPreviews = await SyncEngineService.getInstance().fetchServerStoryPreviews(server.url);

        const localStoryIds = new Set(localStories.map(s => s.id));
        const newStoriesOnServer = serverStoryPreviews.filter(
          (preview: ServerStoryPreview) => !localStoryIds.has(preview.storyId)
        );

        if (newStoriesOnServer.length > 0) {
          console.log(`Found ${newStoriesOnServer.length} new stories on server ${server.name}:`);
          for (const storyPreview of newStoriesOnServer) {
            console.log(`  - Story ID: ${storyPreview.storyId}, Last Operation Version: ${storyPreview.lastOperationVersion}`);
            try {
              await SyncEngineService.getInstance().downloadAndImportStory(server.id, storyPreview.storyId, server.idUser);
              console.log(`Successfully downloaded and imported story ${storyPreview.storyId}.`);
              fetchStoryList(storyService); // Refresh the story list after import
            } catch (downloadError) {
              console.error(`Failed to download and import story ${storyPreview.storyId}:`, downloadError);
              showNotification(t('failed_to_download_story') + `: ${storyPreview.storyId}`, 'error');
            }
          }
        } else {
          console.log(`No new stories found on server ${server.name}.`);
        }
      } catch (error) {
        console.error(`Error during sync with server ${server.name} at ${server.url}:`, error);
        showNotification(t('failed_to_sync_with_server') + `: ${server.name}`, 'error');
      }
    }
  }, [drizzleClient, userId, storyService, showNotification, t, fetchStoryList, friendshipService]);

  // Use a separate useEffect with an empty dependency array to call syncStoriesWithServers once and set up the interval
  useEffect(() => {
    syncStoriesWithServers();
    const syncInterval = setInterval(syncStoriesWithServers, 1800000); // 30 minutes

    return () => {
      clearInterval(syncInterval);
    };
  }, [syncStoriesWithServers]); // Dependency on syncStoriesWithServers ensures the latest version is used

  return <>{children}</>;
};

export default SyncInitializer;
