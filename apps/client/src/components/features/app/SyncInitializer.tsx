import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../../../db';
import apiClient, { isOfflineError } from '../../../services/apiClient';
import { authTokenManager, setAuthDb } from '../../../services/AuthTokenManager';
import { createFriendshipService } from '../../../services/FriendshipService';
import { createServerService } from '../../../services/ServerService';
import { ServerRealtimeService } from '../../../services/ServerRealtimeService';
import { createStoryService } from '../../../services/storymanagement/StoryService';
import type { ServerStoryPreview } from '../../../services/SyncEngineService';
import { SyncEngineService } from '../../../services/SyncEngineService';
import { useNotificationStore } from '../../../state/notificationStore';
import { useStoryListStore } from '../../../state/storyListStore';
import { useStoryStore } from '../../../state/storyStore'; // Import useStoryStore
import { useSyncConflictStore } from '../../../state/syncConflictStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { entityEventEmitter } from '../../../utils/EventEmitter';

interface SyncInitializerProps {
  children: React.ReactNode;
}

const SyncInitializer: React.FC<SyncInitializerProps> = ({ children }) => {
  const drizzleClient = useDrizzle();
  const storyService = useRef(createStoryService(drizzleClient)).current;
  const friendshipService = useRef(createFriendshipService(drizzleClient)).current;
  const { userId, activeServer } = useUserSettingsStore();
  // Registering or re-authenticating a server happens while this component remains mounted.
  // A scalar revision makes the reconciliation/WebSocket effects react to that persisted
  // connection without depending on object identity (which would reconnect unnecessarily).
  const serverConnectionRevision = activeServer
    ? `${activeServer.id}:${activeServer.idUser}:${activeServer.url}:${activeServer.updatedAt.getTime()}`
    : '';
  const { showNotification } = useNotificationStore();
  const { fetchStories: fetchStoryList } = useStoryListStore();
  const { selectedStory } = useStoryStore(); // Get selectedStory from useStoryStore
  const { t } = useTranslation();
  const realtimeByServerRef = useRef(new Map<string, ServerRealtimeService>());
  const activeReconciliationsRef = useRef(new Set<Promise<unknown>>());
  const [serverRegistryRevision, setServerRegistryRevision] = useState(0);

  useEffect(() => {
    const stopRealtimeForReset = async () => {
      const realtimeStops = Array.from(realtimeByServerRef.current.values()).map((realtime) =>
        realtime.stop(),
      );
      realtimeByServerRef.current.clear();
      await Promise.allSettled([...realtimeStops, ...Array.from(activeReconciliationsRef.current)]);
    };
    entityEventEmitter.on('application_resetting', stopRealtimeForReset);
    return () => entityEventEmitter.off('application_resetting', stopRealtimeForReset);
  }, []);

  useEffect(() => {
    // Set token provider for apiClient once on mount
    apiClient.setTokenProvider(authTokenManager);

    // Cleanup function to unsubscribe when the component unmounts
    return () => {};
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  /** Resolves to true when at least one server was unreachable, so the caller can retry sooner. */
  const syncDataWithServers = useCallback(async (): Promise<boolean> => {
    if (!drizzleClient || !userId) {
      console.warn('Drizzle client or userId not available for sync. Skipping.');
      return false;
    }

    SyncEngineService.getInstance().setDbInstance(drizzleClient);
    setAuthDb(drizzleClient); // Ensure authDb is set, especially if drizzleClient changes

    const serverService = createServerService(drizzleClient);
    let localStories: Awaited<ReturnType<typeof storyService.getAllStories>>;
    let servers: Awaited<ReturnType<typeof serverService.getAllServers>>;
    try {
      localStories = await storyService.getAllStories();
      servers = await serverService.getAllServers();
    } catch (error) {
      console.error(
        'SyncInitializer: Failed to read local stories/servers, skipping this sync cycle.',
        error,
      );
      return false;
    }

    let sawUnreachableServer = false;

    for (let server of servers) {
      if (!server.url) {
        console.warn(`Server ${server.name} has no URL configured. Skipping.`);
        continue;
      }

      // Explicitly set the active server for apiClient for the current server
      apiClient.setActiveServer(server);
      apiClient.setBaseUrl(server.url); // Set base URL explicitly

      console.log(`Checking server ${server.name} at ${server.url} for new stories...`);
      try {
        server = await serverService.refreshServerToken(server);
        await friendshipService.syncFriendshipsWithServer(userId, server); // Call friendship sync

        const serverStoryPreviews =
          await SyncEngineService.getInstance().fetchServerStoryPreviews(server);

        const localStoryIds = new Set(localStories.map((s) => s.id));
        const newStoriesOnServer = serverStoryPreviews.filter(
          (preview: ServerStoryPreview) => !localStoryIds.has(preview.storyId),
        );

        if (newStoriesOnServer.length > 0) {
          console.log(`Found ${newStoriesOnServer.length} new stories on server ${server.name}:`);
          for (const storyPreview of newStoriesOnServer) {
            console.log(
              `  - Story ID: ${storyPreview.storyId}, Last Operation Version: ${storyPreview.lastOperationVersion}`,
            );
            try {
              await SyncEngineService.getInstance().downloadAndImportStory(
                server.id,
                storyPreview.storyId,
                server.idUser,
                storyPreview.role,
              );
              console.log(`Successfully downloaded and imported story ${storyPreview.storyId}.`);
              fetchStoryList(storyService); // Refresh the story list after import
            } catch (downloadError) {
              if (isOfflineError(downloadError)) {
                console.log(
                  `Server unreachable while downloading story ${storyPreview.storyId}, will retry.`,
                );
                sawUnreachableServer = true;
                continue;
              }
              console.log(
                `Failed to download and import story ${storyPreview.storyId}:`,
                (downloadError as Error)?.message || downloadError,
              );
              showNotification(
                t('failed_to_download_story') + `: ${storyPreview.storyId}`,
                'error',
              );
            }
          }
        } else {
          console.log(`No new stories found on server ${server.name}.`);
        }
      } catch (error) {
        if (isOfflineError(error)) {
          // Server unreachable: expected in an offline-first app, retried on a shorter delay.
          console.log(`Server ${server.name} is unreachable, skipping this cycle.`);
          sawUnreachableServer = true;
          continue;
        }
        console.log(
          `Error during sync with server ${server.name} at ${server.url}:`,
          (error as Error)?.message || error,
        );
        showNotification(t('failed_to_sync_with_server') + `: ${server.name}`, 'error');
      }
    }

    return sawUnreachableServer;
  }, [drizzleClient, userId, storyService, showNotification, t, fetchStoryList, friendshipService]);

  const startServerReconciliation = useCallback(() => {
    // Continuous 30-second polling is replaced by ServerRealtimeService notifications.
    const reconciliation = syncDataWithServers();
    activeReconciliationsRef.current.add(reconciliation);
    reconciliation
      .catch((error) => console.log('SyncInitializer: initial reconciliation failed.', error))
      .finally(() => activeReconciliationsRef.current.delete(reconciliation));
  }, [syncDataWithServers]);

  useEffect(() => {
    // One initial reconciliation covers data that changed while the app was closed.
    startServerReconciliation();
  }, [startServerReconciliation]);

  useEffect(() => {
    // Server registration happens below this already-mounted component. Use an explicit
    // signal so its first friendship/story reconciliation does not depend on navigation
    // timing or on Zustand observing a different active-server object.
    const handleServerConnectionChanged = () => {
      setServerRegistryRevision((revision) => revision + 1);
      startServerReconciliation();
    };
    entityEventEmitter.on('server_connection_changed', handleServerConnectionChanged);
    return () => entityEventEmitter.off('server_connection_changed', handleServerConnectionChanged);
  }, [startServerReconciliation]);

  // Friendship and permission events matter even when no story is open. Keep one
  // WebSocket per configured server for the lifetime of the signed-in client.
  useEffect(() => {
    if (!drizzleClient || !userId) return;
    let disposed = false;
    const realtimeConnections = realtimeByServerRef.current;
    const connectServers = async () => {
      const servers = await createServerService(drizzleClient).getAllServers();
      if (disposed) return;
      for (const server of servers) {
        const realtime = new ServerRealtimeService(drizzleClient, server, server.idUser);
        realtimeConnections.set(server.id, realtime);
        realtime.start(server.id === selectedStory?.serverId ? selectedStory.id : undefined);
      }
    };
    connectServers().catch((error) =>
      console.log('SyncInitializer: failed to start realtime connections.', error),
    );
    return () => {
      disposed = true;
      for (const realtime of realtimeConnections.values()) void realtime.stop();
      realtimeConnections.clear();
    };
  }, [
    drizzleClient,
    userId,
    selectedStory?.id,
    selectedStory?.serverId,
    serverConnectionRevision,
    serverRegistryRevision,
  ]);

  // A local operation is ready to push immediately. Remote application also emits
  // this event, but requestSync coalesces it into at most one follow-up pull.
  useEffect(() => {
    const pushLocalChange = (storyId: string) => {
      if (storyId === selectedStory?.id) {
        SyncEngineService.getInstance().requestSync('local-change');
      }
    };
    entityEventEmitter.on('operation_log_updated', pushLocalChange);
    return () => entityEventEmitter.off('operation_log_updated', pushLocalChange);
  }, [selectedStory?.id]);

  // Mantém a lista de conflitos pendentes em sincronia com o banco. O motor de
  // sincronização emite o evento quando um push é recusado ou quando um pull colide com
  // edições locais; é isso que faz a tela de resolução aparecer.
  useEffect(() => {
    if (!drizzleClient) {
      return;
    }

    const refreshConflicts = () => {
      useSyncConflictStore
        .getState()
        .refresh(drizzleClient, selectedStory?.id)
        .catch((error) => {
          console.log('SyncInitializer: failed to refresh sync conflicts.', error);
        });
    };

    refreshConflicts();
    entityEventEmitter.on('sync_conflicts_changed', refreshConflicts);
    return () => {
      entityEventEmitter.off('sync_conflicts_changed', refreshConflicts);
    };
  }, [drizzleClient, selectedStory?.id]);

  // NEW: useEffect to handle push synchronization for the selected story
  useEffect(() => {
    let serverService: ReturnType<typeof createServerService> | undefined;
    if (drizzleClient) {
      serverService = createServerService(drizzleClient);
    }

    const manageStorySync = async () => {
      if (!drizzleClient || !serverService || !selectedStory?.id) {
        console.log(
          'SyncInitializer: No active story or DB/ServerService, stopping sync for selected story.',
        );
        SyncEngineService.getInstance().stopSync();
        useUserSettingsStore.getState().clearActiveServer(); // Clear active server
        return;
      }

      // Check if the selected story is linked to a server
      if (selectedStory.serverId) {
        try {
          const server = await serverService.getServerById(selectedStory.serverId);
          if (server?.url) {
            console.log(
              `SyncInitializer: Configuring and starting sync for story ${selectedStory.id} with server ${server.name} (${server.url}).`,
            );
            SyncEngineService.getInstance().configure(selectedStory.id, server);
            SyncEngineService.getInstance().requestSync('initial');
            // Sem isto, o único jeito de sincronizar era um evento local ou uma mensagem de
            // WebSocket - uma desconexão perdida ou um app em background por um tempo deixava
            // o estado local parado, sem nenhum recurso de reconciliação periódica (ver
            // plano de correção de sync/conflitos). `startSync` é um no-op se já estiver
            // rodando, então é seguro chamar de novo a cada troca de história/servidor.
            SyncEngineService.getInstance().startSync();
            realtimeByServerRef.current.get(server.id)?.subscribeToStory(selectedStory.id);
            useUserSettingsStore.getState().setActiveServer(server); // Set the active server in the store
          } else {
            console.warn(
              `SyncInitializer: Selected story ${selectedStory.id} has serverId ${selectedStory.serverId}, but server URL not found. Stopping sync.`,
            );
            SyncEngineService.getInstance().stopSync();
            useUserSettingsStore.getState().clearActiveServer(); // Clear active server
          }
        } catch (error) {
          console.error(
            `SyncInitializer: Error fetching server details for story ${selectedStory.id}:`,
            error,
          );
          showNotification(t('failed_to_sync_with_server') + `: ${selectedStory.id}`, 'error');
          SyncEngineService.getInstance().stopSync();
          useUserSettingsStore.getState().clearActiveServer(); // Clear active server
        }
      } else {
        console.log(
          `SyncInitializer: Selected story ${selectedStory.id} is not linked to a server. Stopping sync.`,
        );
        SyncEngineService.getInstance().stopSync();
        useUserSettingsStore.getState().clearActiveServer(); // Clear active server
      }
    };

    manageStorySync().catch((error) => {
      if (isOfflineError(error)) {
        console.log('SyncInitializer: story sync setup skipped, server unreachable.');
        return;
      }
      console.error('SyncInitializer: Unexpected error while managing story sync.', error);
    });

    // Cleanup function: stop sync when component unmounts or dependencies change
    return () => {
      console.log('SyncInitializer: Cleaning up story sync. Stopping sync engine.');
      SyncEngineService.getInstance().stopSync();
      useUserSettingsStore.getState().clearActiveServer(); // Clear active server on unmount/dependency change
    };
    // serverId matters as much as id here: linking an existing story to a server changes
    // serverId while id stays put, and sync must reconfigure when that happens.
  }, [
    selectedStory?.id,
    selectedStory?.serverId,
    drizzleClient,
    showNotification,
    t,
    serverRegistryRevision,
  ]);

  return <>{children}</>;
};

export default SyncInitializer;
