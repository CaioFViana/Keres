import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import type { ServerSelect } from '../db/schema';
import { isOfflineError } from '../services/apiClient';
import { createFriendshipService } from '../services/FriendshipService';
import { createServerService } from '../services/ServerService';
import { createStoryService } from '../services/storymanagement/StoryService';
import type { StoryCollaborator } from '../services/StoryPermissionService';
import { storyPermissionApi } from '../services/StoryPermissionService';
import { SyncEngineService } from '../services/SyncEngineService';
import { useStoryStore } from '../state/storyStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { AppAlert } from '../utils/AppAlert';

export function useStoryServerCollaboration(storyId: string | undefined) {
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { selectedStory, setSelectedStory } = useStoryStore();
  const storyService = useCallback(() => createStoryService(drizzleDb), [drizzleDb]);
  const serverService = useCallback(() => createServerService(drizzleDb), [drizzleDb]);
  const friendshipService = useCallback(() => createFriendshipService(drizzleDb), [drizzleDb]);

  const [serverId, setServerId] = useState<string | null>(null);
  const [availableServers, setAvailableServers] = useState<ServerSelect[]>([]);
  const [uploadTargetServerId, setUploadTargetServerId] = useState<string | null>(null);
  const [isOwnerOnServer, setIsOwnerOnServer] = useState<boolean | null>(null);
  const [collaborators, setCollaborators] = useState<StoryCollaborator[] | null>(null);
  const [serverActionLoading, setServerActionLoading] = useState(false);
  const [addableFriends, setAddableFriends] = useState<{ id: string; username: string }[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedPermissionType, setSelectedPermissionType] = useState<'reader' | 'writer'>(
    'reader',
  );

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    (async () => {
      try {
        const servers = await serverService().getAllServers();
        if (cancelled) return;
        setAvailableServers(servers);
        const currentServerId = selectedStory?.serverId ?? null;
        if (!currentServerId) {
          setServerId(null);
          return;
        }
        const found = servers.find((server) => server.id === currentServerId);
        if (found) {
          setServerId(currentServerId);
          return;
        }
        if (userId) await storyService().updateStory(userId, storyId, { serverId: null });
        setServerId(null);
        AppAlert.alert(t('warning'), t('server_not_found_for_story'));
      } catch (err) {
        if (!cancelled) console.error('Failed to load servers for story settings:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storyId, selectedStory?.serverId, serverService, storyService, userId, t]);

  const linkedServer = availableServers.find((server) => server.id === serverId) ?? null;

  useEffect(() => {
    if (!storyId || !linkedServer) {
      setIsOwnerOnServer(null);
      setCollaborators(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const fetchedCollaborators = await storyPermissionApi.getCollaborators(
          linkedServer,
          storyId,
        );
        if (!cancelled) {
          setIsOwnerOnServer(true);
          setCollaborators(fetchedCollaborators);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.response?.status === 403) {
          setIsOwnerOnServer(false);
        } else {
          console.error('Failed to check story ownership/collaborators on server:', err);
          setIsOwnerOnServer(null);
        }
        setCollaborators(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storyId, linkedServer]);

  useEffect(() => {
    if (!linkedServer || isOwnerOnServer !== true) {
      setAddableFriends([]);
      setSelectedFriendId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const allFriendships = await friendshipService().getAllFriendships();
        const collaboratorIds = new Set((collaborators ?? []).map((c) => c.userId));
        const friends = allFriendships
          .filter((f) => f.serverId === linkedServer.id && f.status === FriendStatus.FRIEND)
          .map((f) => ({ id: f.otherUserId, username: f.friendUsername }))
          .filter((f) => !collaboratorIds.has(f.id));
        if (!cancelled) setAddableFriends(friends);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load friends for collaborator picker:', err);
          setAddableFriends([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedServer, isOwnerOnServer, collaborators, friendshipService]);

  const handleSendToServer = async () => {
    if (!storyId || !userId || !uploadTargetServerId) return;
    const targetServer = availableServers.find((server) => server.id === uploadTargetServerId);
    if (!targetServer) return;
    setServerActionLoading(true);
    try {
      const result = await SyncEngineService.getInstance().uploadNewStoryToServer(
        storyId,
        targetServer,
        userId,
      );
      if (result.success) {
        setServerId(targetServer.id);
        setUploadTargetServerId(null);
        if (selectedStory) setSelectedStory({ ...selectedStory, serverId: targetServer.id });
        AppAlert.alert(t('success'), t('send_to_server_success'));
      } else if (result.reason === 'already_exists') {
        AppAlert.alert(t('error'), t('send_to_server_already_exists'));
      } else {
        AppAlert.alert(t('error'), t('send_to_server_failed'));
      }
    } catch (err) {
      console.error('Failed to send story to server:', err);
      AppAlert.alert(t('error'), t('send_to_server_failed'));
    } finally {
      setServerActionLoading(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!storyId || !linkedServer || !selectedFriendId) return;
    setServerActionLoading(true);
    try {
      await storyPermissionApi.grantCollaborator(
        linkedServer,
        storyId,
        selectedFriendId,
        selectedPermissionType,
      );
      setCollaborators(await storyPermissionApi.getCollaborators(linkedServer, storyId));
      setSelectedFriendId(null);
      setSelectedPermissionType('reader');
    } catch (err) {
      console.error('Failed to add collaborator:', err);
      AppAlert.alert(t('error'), t('add_collaborator_failed'));
    } finally {
      setServerActionLoading(false);
    }
  };

  const handleUpdateCollaboratorPermission = async (
    collaborator: StoryCollaborator,
    permissionType: 'reader' | 'writer',
  ) => {
    if (!storyId || !linkedServer || permissionType === collaborator.permissionType) return;
    setServerActionLoading(true);
    try {
      await storyPermissionApi.updateCollaboratorPermission(
        linkedServer,
        storyId,
        collaborator.userId,
        permissionType,
      );
      setCollaborators(await storyPermissionApi.getCollaborators(linkedServer, storyId));
    } catch (err) {
      console.error('Failed to update collaborator permission:', err);
      AppAlert.alert(t('error'), t('update_collaborator_permission_failed'));
    } finally {
      setServerActionLoading(false);
    }
  };

  const handleRemoveCollaborator = (collaborator: StoryCollaborator) => {
    if (!storyId || !linkedServer) return;
    AppAlert.alert(
      t('remove_collaborator_title'),
      t('remove_collaborator_message', {
        username: collaborator.user?.username ?? collaborator.userId,
      }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('remove'),
          style: 'destructive',
          onPress: async () => {
            setServerActionLoading(true);
            try {
              await storyPermissionApi.removeCollaborator(
                linkedServer,
                storyId,
                collaborator.userId,
              );
              setCollaborators((current) =>
                (current ?? []).filter((c) => c.userId !== collaborator.userId),
              );
            } catch (err) {
              console.error('Failed to remove collaborator:', err);
              AppAlert.alert(t('error'), t('remove_collaborator_failed'));
            } finally {
              setServerActionLoading(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleUnlinkFromServer = () => {
    if (!storyId || !userId) return;
    AppAlert.alert(t('unlink_from_server_title'), t('unlink_from_server_message'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('unlink'),
        style: 'destructive',
        onPress: async () => {
          setServerActionLoading(true);
          try {
            await storyService().unlinkFromServer(userId, storyId);
            setServerId(null);
            setIsOwnerOnServer(null);
            setCollaborators(null);
            if (selectedStory) setSelectedStory({ ...selectedStory, serverId: null });
            AppAlert.alert(t('success'), t('unlink_from_server_success'));
          } catch (err) {
            console.error('Failed to unlink story from server:', err);
            AppAlert.alert(
              t('error'),
              isOfflineError(err) ? t('unlink_from_server_offline') : t('unlink_from_server_failed'),
            );
          } finally {
            setServerActionLoading(false);
          }
        },
      },
    ]);
  };

  return {
    serverId,
    linkedServer,
    uploadTargetServerId,
    setUploadTargetServerId,
    isOwnerOnServer,
    collaborators,
    serverActionLoading,
    addableFriends,
    selectedFriendId,
    setSelectedFriendId,
    selectedPermissionType,
    setSelectedPermissionType,
    handleSendToServer,
    handleAddCollaborator,
    handleUpdateCollaboratorPermission,
    handleRemoveCollaborator,
    handleUnlinkFromServer,
    uploadServerOptions: availableServers.map((server) => ({
      label: server.name,
      value: server.id,
    })),
    addableFriendOptions: addableFriends.map((friend) => ({
      label: friend.username,
      value: friend.id,
    })),
  };
}
