import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_RELEASE, canTalkToServer } from '@keres/shared';
import { useDrizzle } from '../../../db';
import apiClient, { apiUrl, isOfflineError } from '../../../services/apiClient';
import { authTokenManager, setAuthDb } from '../../../services/AuthTokenManager';
import { setEditorDraftDb } from '../../../services/EditorDraftService';
import { createFriendshipService } from '../../../services/FriendshipService';
import { createServerService } from '../../../services/ServerService';
import { ServerRealtimeService } from '../../../services/ServerRealtimeService';
import { createStoryService } from '../../../services/storymanagement/StoryService';
import type { ServerStoryPreview } from '../../../services/SyncEngineService';
import { syncEngine } from '../../../services/sync/appSyncEngine';
import { useNotificationStore } from '../../../state/notificationStore';
import { useStoryListStore } from '../../../state/storyListStore';
import { useStoryStore } from '../../../state/storyStore'; // Import useStoryStore
import { useSyncConflictStore } from '../../../state/syncConflictStore';
import { useUserSettingsStore } from '../../../state/userSettingsStore';
import { entityEventEmitter } from '../../../utils/EventEmitter';
import { useEntityInitialLoad } from '../../../hooks/useEntityRefreshLifecycle';

interface SyncInitializerProps {
  children: React.ReactNode;
}

const SyncInitializer: React.FC<SyncInitializerProps> = ({ children }) => {
  const drizzleClient = useDrizzle();
  const [storyService] = useState(() => createStoryService(drizzleClient));
  const [friendshipService] = useState(() => createFriendshipService(drizzleClient));
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
  // Connections outlive story switches, so the subscription applier reads the current story
  // from a ref instead of closing over the render's value. Synced in an effect (not during
  // render), and declared before the connection effects so it lands first every commit.
  const selectedStoryRef = useRef(selectedStory);
  useEffect(() => {
    selectedStoryRef.current = selectedStory;
  });

  /** Points every live connection at the selected story (or none); the sockets stay up. */
  const applyStorySubscription = useCallback(() => {
    const current = selectedStoryRef.current;
    for (const [serverId, realtime] of realtimeByServerRef.current) {
      realtime.subscribeToStory(serverId === current?.serverId ? current.id : undefined);
    }
  }, []);
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

    await syncEngine.bindDatabase(drizzleClient);
    setAuthDb(drizzleClient); // Ensure authDb is set, especially if drizzleClient changes
    setEditorDraftDb(drizzleClient);

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
        // The protocol was checked when this server was registered, but the app may have updated
        // since: recheck before doing sync work, or an old server fails every call below with
        // cryptic validation errors instead of one clear "update your server".
        const check = await apiClient
          .get(apiUrl(server.url, '/kerescheck'), { timeout: 5000, validateStatus: () => true })
          .catch(() => null);
        if (check && check.status === 200 && check.data?.version) {
          if (!canTalkToServer(check.data.syncProtocol)) {
            console.log(
              `Server ${server.name} speaks sync protocol ${JSON.stringify(check.data.syncProtocol)}, too old for this app; skipping until it updates.`,
            );
            showNotification(
              t('server_version_mismatch', {
                serverVersion: check.data.version,
                appVersion: APP_RELEASE.version,
              }),
              'error',
            );
            continue;
          }
        }
        // Unreachable or unparsable: fall through to the normal calls below, whose own
        // offline/failure handling already covers those cases.
        await friendshipService.syncFriendshipsWithServer(userId, server); // Call friendship sync

        const serverStoryPreviews = await syncEngine.fetchServerStoryPreviews(server);

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
              await syncEngine.downloadAndImportStory(
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
  // WebSocket per configured server for the lifetime of the signed-in client. Story switches
  // only re-point the subscriptions (next effect): tearing every socket down and rebuilding it
  // on each switch drops in-flight events and churns tickets for no delivery gain - the server
  // pushes every readable story's events on each socket either way.
  useEffect(() => {
    if (!drizzleClient || !userId) return;
    let disposed = false;
    const realtimeConnections = realtimeByServerRef.current;
    const connectServers = async () => {
      const servers = await createServerService(drizzleClient).getAllServers();
      if (disposed) return;
      for (const server of servers) {
        const realtime = new ServerRealtimeService(
          drizzleClient,
          server,
          server.idUser,
          syncEngine,
        );
        realtimeConnections.set(server.id, realtime);
        realtime.start();
      }
      // The subscription effect below may have run while the connections did not exist yet.
      applyStorySubscription();
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
    serverConnectionRevision,
    serverRegistryRevision,
    applyStorySubscription,
  ]);

  // The active story moves between renders; the sockets must not follow it down and up.
  useEffect(() => {
    applyStorySubscription();
  }, [applyStorySubscription, selectedStory?.id, selectedStory?.serverId]);

  // A local operation is ready to push immediately. Remote application also emits
  // this event, but requestSync coalesces it into at most one follow-up pull.
  useEffect(() => {
    const pushLocalChange = (storyId: string) => {
      if (storyId === selectedStory?.id) {
        syncEngine.requestSync('local-change');
      }
    };
    entityEventEmitter.on('operation_log_updated', pushLocalChange);
    return () => entityEventEmitter.off('operation_log_updated', pushLocalChange);
  }, [selectedStory?.id]);

  const refreshConflicts = useCallback(() => {
    if (drizzleClient) {
      useSyncConflictStore
        .getState()
        .refresh(drizzleClient, selectedStory?.id)
        .catch((error) => {
          console.log('SyncInitializer: failed to refresh sync conflicts.', error);
        });
    }
  }, [drizzleClient, selectedStory?.id]);

  useEntityInitialLoad(refreshConflicts);

  // Keeps the list of pending conflicts in sync with the database. The synchronization
  // engine emits the event when a push is refused or when a pull collides with local
  // edits; that is what makes the resolution screen appear.
  useEffect(() => {
    entityEventEmitter.on('sync_conflicts_changed', refreshConflicts);
    return () => {
      entityEventEmitter.off('sync_conflicts_changed', refreshConflicts);
    };
  }, [refreshConflicts]);

  // NEW: useEffect to handle push synchronization for the selected story
  useEffect(() => {
    let cancelled = false;
    let serverService: ReturnType<typeof createServerService> | undefined;
    if (drizzleClient) {
      serverService = createServerService(drizzleClient);
    }

    const manageStorySync = async () => {
      if (!drizzleClient || !serverService || !selectedStory?.id) {
        console.log(
          'SyncInitializer: No active story or DB/ServerService, stopping sync for selected story.',
        );
        await syncEngine.deactivateStory();
        useUserSettingsStore.getState().clearActiveServer(); // Clear active server
        return;
      }

      // Check if the selected story is linked to a server
      if (selectedStory.serverId) {
        try {
          const server = await serverService.getServerById(selectedStory.serverId);
          if (cancelled) return;
          if (server?.url) {
            console.log(
              `SyncInitializer: Configuring and starting sync for story ${selectedStory.id} with server ${server.name} (${server.url}).`,
            );
            try {
              await syncEngine.activateStory(selectedStory.id, server);
            } catch (activateError) {
              // The switch waits for the running cycle to stop; on a wedged cycle it times out
              // while the cycle is nearly always gone a moment later. One retry beats stranding
              // sync off - a second failure falls through to the toast-and-deactivate below.
              if (cancelled) throw activateError;
              console.log(
                `SyncInitializer: story activation failed, retrying once:`,
                activateError,
              );
              await syncEngine.activateStory(selectedStory.id, server);
            }
            if (cancelled) return;
            // Without this, the only way to synchronize was a local event or a WebSocket
            // message - a missed disconnection or an app in the background for a while left
            // the local state stuck, with no periodic reconciliation to fall back on (see the
            // sync/conflicts fix plan). `startSync` is a no-op if it is already
            // running, so it is safe to call again on every story/server change. Its own
            // immediate cycle makes a preceding `requestSync` pure duplication (the request
            // would only coalesce a redundant second cycle), so there is none here.
            syncEngine.startSync();
            realtimeByServerRef.current.get(server.id)?.subscribeToStory(selectedStory.id);
            useUserSettingsStore.getState().setActiveServer(server); // Set the active server in the store
          } else {
            console.warn(
              `SyncInitializer: Selected story ${selectedStory.id} has serverId ${selectedStory.serverId}, but server URL not found. Stopping sync.`,
            );
            await syncEngine.deactivateStory();
            useUserSettingsStore.getState().clearActiveServer(); // Clear active server
          }
        } catch (error) {
          console.error(
            `SyncInitializer: Error fetching server details for story ${selectedStory.id}:`,
            error,
          );
          showNotification(t('failed_to_sync_with_server') + `: ${selectedStory.id}`, 'error');
          await syncEngine.deactivateStory();
          useUserSettingsStore.getState().clearActiveServer(); // Clear active server
        }
      } else {
        console.log(
          `SyncInitializer: Selected story ${selectedStory.id} is not linked to a server. Stopping sync.`,
        );
        await syncEngine.deactivateStory();
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
      cancelled = true;
      console.log('SyncInitializer: Cleaning up story sync. Stopping sync engine.');
      void syncEngine.deactivateStory().catch((error) => {
        console.error('SyncInitializer: Failed to deactivate story sync.', error);
      });
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
