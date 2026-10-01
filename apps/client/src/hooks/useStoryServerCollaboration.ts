import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import type { ServerSelect } from '../db/schema';
import { isOfflineError } from '../services/apiClient';
import { createFriendshipService } from '../services/FriendshipService';
import { createServerService } from '../services/ServerService';
import { createStoryService } from '../services/storymanagement/StoryService';
import type { StoryCollaborator } from '../services/StoryPermissionService';
import { storyPermissionApi } from '../services/StoryPermissionService';
import { closeStoryInvitation } from '../services/storyInvitationActions';
import { storyInvitationApi } from '../services/StoryInvitationApiService';
import {
  createStoryInvitationService,
  type ServerStoryInvitation,
} from '../services/StoryInvitationService';
import { syncEngine } from '../services/sync/appSyncEngine';
import { useNotificationStore } from '../state/notificationStore';
import { useStoryStore } from '../state/storyStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { AppAlert } from '../utils/AppAlert';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useStoryInvitations } from './useStoryInvitations';

/**
 * Server linkage and collaboration state for one story's settings screen.
 *
 * Owns three chained async stages: (1) resolve the linked server from the local
 * registry, (2) probe ownership by fetching collaborators (a 403 means "not owner",
 * not an error), (3) list addable friends once ownership is confirmed. Each stage
 * guards its own `cancelled` flag and each handoff resets the downstream state
 * during render, so switching stories can never show the previous story's server,
 * collaborators, or friend picker.
 */
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
  const { showNotification } = useNotificationStore();

  // Invitations the owner sent for this story and nobody answered yet: they are not collaborators
  // (no access, nothing downloaded) until accepted.
  const allInvitations = useStoryInvitations();
  const pendingInvitations = useMemo(
    () =>
      linkedServer && storyId
        ? allInvitations.filter(
            (invitation) =>
              invitation.serverId === linkedServer.id &&
              invitation.storyId === storyId &&
              invitation.inviterId === linkedServer.idUser,
          )
        : [],
    [allInvitations, linkedServer, storyId],
  );
  // An invitation leaving the list may be an acceptance: the collaborator list is fetched again.
  const pendingKey = pendingInvitations.map((invitation) => invitation.id).join(',');
  // Somebody joined, left or was removed - here or on another device: the server says so, and the list is read again.
  const [collaboratorsTick, setCollaboratorsTick] = useState(0);
  useEffect(() => {
    const onChanged = (changedStoryId: string, changedServerId: string) => {
      if (changedStoryId === storyId && changedServerId === linkedServer?.id) {
        setCollaboratorsTick((tick) => tick + 1);
      }
    };
    entityEventEmitter.on('story_collaborators_changed', onChanged);
    return () => entityEventEmitter.off('story_collaborators_changed', onChanged);
  }, [storyId, linkedServer?.id]);

  const [prevStoryId, setPrevStoryId] = useState(storyId);
  const [prevLinkedServer, setPrevLinkedServer] = useState(linkedServer);
  if (storyId !== prevStoryId || linkedServer !== prevLinkedServer) {
    setPrevStoryId(storyId);
    setPrevLinkedServer(linkedServer);
    if (!storyId || !linkedServer) {
      setIsOwnerOnServer(null);
      setCollaborators(null);
    }
  }

  useEffect(() => {
    if (!storyId || !linkedServer) {
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
        // A 403 is not an error here - it is how the server reports that the
        // current user is linked to the story but is not its owner.
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
  }, [storyId, linkedServer, pendingKey, collaboratorsTick]);

  useEffect(() => {
    if (linkedServer && isOwnerOnServer === true) {
      createStoryInvitationService(drizzleDb)
        .syncWithServer(linkedServer)
        .catch((error) => console.log('Failed to load story invitations:', error));
    }
  }, [drizzleDb, linkedServer, isOwnerOnServer]);

  const [prevOwnerLinkedServer, setPrevOwnerLinkedServer] = useState(linkedServer);
  const [prevIsOwnerOnServer, setPrevIsOwnerOnServer] = useState(isOwnerOnServer);
  if (linkedServer !== prevOwnerLinkedServer || isOwnerOnServer !== prevIsOwnerOnServer) {
    setPrevOwnerLinkedServer(linkedServer);
    setPrevIsOwnerOnServer(isOwnerOnServer);
    if (!linkedServer || isOwnerOnServer !== true) {
      setAddableFriends([]);
      setSelectedFriendId(null);
    }
  }

  useEffect(() => {
    if (!linkedServer || isOwnerOnServer !== true) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const allFriendships = await friendshipService().getAllFriendships();
        const collaboratorIds = new Set([
          ...(collaborators ?? []).map((c) => c.userId),
          ...pendingInvitations.map((invitation) => invitation.inviteeId),
        ]);
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
  }, [linkedServer, isOwnerOnServer, collaborators, pendingInvitations, friendshipService]);

  const handleSendToServer = async () => {
    if (!storyId || !userId || !uploadTargetServerId) return;
    const targetServer = availableServers.find((server) => server.id === uploadTargetServerId);
    if (!targetServer) return;
    setServerActionLoading(true);
    try {
      const result = await syncEngine.uploadNewStoryToServer(storyId, targetServer, userId);
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

  /** Invites the picked friend: they become a collaborator only once they accept. */
  const handleAddCollaborator = async () => {
    if (!storyId || !linkedServer || !selectedFriendId) return;
    setServerActionLoading(true);
    try {
      const invitation = await storyInvitationApi.invite(
        linkedServer,
        storyId,
        selectedFriendId,
        selectedPermissionType,
      );
      await createStoryInvitationService(drizzleDb).syncWithServer(linkedServer);
      setSelectedFriendId(null);
      setSelectedPermissionType('reader');
      showNotification(t('story_invitation_sent', { name: invitation.inviteeUsername }), 'success');
    } catch (err) {
      console.error('Failed to invite collaborator:', err);
      AppAlert.alert(t('error'), t('invite_collaborator_failed'));
    } finally {
      setServerActionLoading(false);
    }
  };

  /** Changes the role offered by an unanswered invitation (inviting again only updates it). */
  const handleUpdateInvitationRole = async (
    invitation: ServerStoryInvitation,
    permissionType: 'reader' | 'writer',
  ) => {
    if (!storyId || !linkedServer || permissionType === invitation.permissionType) return;
    setServerActionLoading(true);
    try {
      await storyInvitationApi.invite(linkedServer, storyId, invitation.inviteeId, permissionType);
      await createStoryInvitationService(drizzleDb).syncWithServer(linkedServer);
    } catch (err) {
      console.error('Failed to change the invitation role:', err);
      AppAlert.alert(t('error'), t('update_collaborator_permission_failed'));
    } finally {
      setServerActionLoading(false);
    }
  };

  const handleCancelInvitation = (invitation: ServerStoryInvitation) => {
    if (!linkedServer) return;
    AppAlert.alert(
      t('story_invitation_withdraw'),
      t('story_invitation_withdraw_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('proceed'),
          style: 'destructive',
          onPress: async () => {
            setServerActionLoading(true);
            try {
              await closeStoryInvitation(drizzleDb, linkedServer, invitation);
            } catch (err) {
              console.error('Failed to withdraw the invitation:', err);
              AppAlert.alert(t('error'), t('story_invitation_failed'));
            } finally {
              setServerActionLoading(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
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

  /**
   * A collaborator gives up their own access. The server is told first - it has to succeed, or the story
   * would come back on the next sync - and only then is this device's copy removed.
   */
  const handleLeaveStory = (onLeft?: () => void) => {
    if (!storyId || !linkedServer) return;
    AppAlert.alert(t('leave_story_title'), t('leave_story_message'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('leave_story_button'),
        style: 'destructive',
        onPress: async () => {
          setServerActionLoading(true);
          try {
            await storyPermissionApi.leaveStory(linkedServer, storyId);
            await storyService().discardCollaboratedCopy(storyId);
            AppAlert.alert(t('success'), t('leave_story_success'));
            onLeft?.();
          } catch (err: any) {
            // Already out (the owner removed them meanwhile): the server has nothing left to give up.
            if (err?.response?.status === 404) {
              try {
                await storyService().discardCollaboratedCopy(storyId);
                onLeft?.();
                return;
              } catch (purgeError) {
                console.error('Failed to discard the copy of a story already left:', purgeError);
              }
            }
            console.error('Failed to leave the story:', err);
            AppAlert.alert(
              t('error'),
              isOfflineError(err) ? t('leave_story_offline') : t('leave_story_failed'),
            );
          } finally {
            setServerActionLoading(false);
          }
        },
      },
    ]);
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
              isOfflineError(err)
                ? t('unlink_from_server_offline')
                : t('unlink_from_server_failed'),
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
    pendingInvitations,
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
    handleUpdateInvitationRole,
    handleCancelInvitation,
    handleUnlinkFromServer,
    handleLeaveStory,
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
