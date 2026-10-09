import { normalizeUserTag, USER_TAG_MAX_LENGTH, USER_TAG_MIN_LENGTH } from '@keres/shared';
import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { FriendshipStackParamList } from '../../navigation/StorySelectionStack';
import { friendshipApiService } from '../../services/FriendshipApiService';
import type { FriendshipService } from '../../services/FriendshipService';
import { userApiService } from '../../services/UserApiService';
import { useNotificationStore } from '../../state/notificationStore';
import { AppAlert } from '../../utils/AppAlert';
import type { FriendshipFormState } from './useFriendshipFormState';

type FriendshipNavigation = NativeStackNavigationProp<FriendshipStackParamList, 'FriendshipList'>;

type UseFriendshipFormActionsOptions = {
  state: FriendshipFormState;
  friendshipServiceRef: RefObject<FriendshipService | null>;
  navigation: FriendshipNavigation;
  currentUserId?: string | null;
};

/** How long the tag has to sit unchanged before it is looked up. */
export const FRIEND_TAG_LOOKUP_DELAY_MS = 500;

type FoundFriend = { id: string; username: string };

/** Owns validation, friend-tag lookup, persistence and navigation for the Friendship form. */
export function useFriendshipFormActions({
  state,
  friendshipServiceRef,
  navigation,
  currentUserId,
}: UseFriendshipFormActionsOptions) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  // A lookup that finishes after the tag or the server changed describes something no longer typed.
  const lookupId = useRef(0);

  const isTagValid = (tag: string) =>
    tag.length >= USER_TAG_MIN_LENGTH && tag.length <= USER_TAG_MAX_LENGTH;

  /**
   * Looks the typed tag up on the chosen server and says so in the form, not in a dialog. Resolves to
   * the person found, or null when there is none (or the server could not be asked).
   */
  const handleCheckFriendTag = useCallback(async (): Promise<FoundFriend | null> => {
    // Read the way tags are stored: "@Caio Viana", "caio viana" and "CAIO_VIANA" are one tag.
    const friendTag = normalizeUserTag(state.friendTag);
    if (!isTagValid(friendTag) || !state.selectedServer) return null;

    const id = ++lookupId.current;
    state.setIsCheckingFriend(true);
    state.setFriendFound(null);
    state.setCheckFailed(false);
    state.setFriendUsername(null);
    state.setResolvedFriendUserId(null);
    try {
      const userDetails = await userApiService.getUserByTag(state.selectedServer, friendTag);
      if (id !== lookupId.current) return null;
      if (!userDetails) {
        state.setFriendFound(false);
        return null;
      }
      state.setFriendUsername(userDetails.username);
      state.setResolvedFriendUserId(userDetails.id);
      state.setFriendFound(true);
      return { id: userDetails.id, username: userDetails.username };
    } catch (error) {
      console.error('Error checking friend tag:', error);
      if (id !== lookupId.current) return null;
      state.setCheckFailed(true);
      return null;
    } finally {
      if (id === lookupId.current) state.setIsCheckingFriend(false);
    }
  }, [state]);

  // The lookup runs by itself once the tag stops changing, so there is no "check" button to find.
  const checkRef = useRef(handleCheckFriendTag);
  checkRef.current = handleCheckFriendTag;
  useEffect(() => {
    const tag = normalizeUserTag(state.friendTag);
    if (!state.selectedServerId || !isTagValid(tag)) return undefined;
    const timer = setTimeout(() => void checkRef.current(), FRIEND_TAG_LOOKUP_DELAY_MS);
    return () => {
      clearTimeout(timer);
      lookupId.current += 1;
    };
  }, [state.friendTag, state.selectedServerId]);

  const handleSaveFriendship = useCallback(async () => {
    if (!currentUserId) {
      AppAlert.alert(t('error'), t('not_logged_in'));
      return;
    }
    if (!state.selectedServer || !state.selectedServer.idUser) {
      AppAlert.alert(t('error'), t('selected_server_invalid'));
      return;
    }
    if (!isTagValid(normalizeUserTag(state.friendTag))) {
      AppAlert.alert(t('error'), t('invalid_friend_id_format'));
      return;
    }
    if (!friendshipServiceRef.current) {
      AppAlert.alert(t('error'), t('failed_to_save_friendship'));
      return;
    }

    // Pressed before the automatic lookup finished (or after it failed): look now.
    const friend: FoundFriend | null =
      state.resolvedFriendUserId && state.friendUsername
        ? { id: state.resolvedFriendUserId, username: state.friendUsername }
        : await handleCheckFriendTag();
    if (!friend) return;

    try {
      const currentUserServerId = state.selectedServer.idUser;

      // Compare per-server IDs, not the local app-installation currentUserId.
      if (friend.id === currentUserServerId) {
        AppAlert.alert(t('error'), t('cannot_friend_self'));
        return;
      }

      // Server first so a rejected request never leaves an orphaned local PENDING row.
      await friendshipApiService.sendFriendRequest(state.selectedServer, friend.id);

      await friendshipServiceRef.current.addFriendship({
        senderId: currentUserServerId,
        receiverId: friend.id,
        serverId: state.selectedServerId,
        status: FriendStatus.PENDING,
        friendUsername: friend.username,
      });

      showNotification(t('friend_request_sent_notice', { name: friend.username }), 'success');
      navigation.goBack();
    } catch (error) {
      console.error('Error saving friendship:', error);
      AppAlert.alert(t('error'), t('failed_to_save_friendship'));
    }
  }, [
    currentUserId,
    friendshipServiceRef,
    handleCheckFriendTag,
    navigation,
    showNotification,
    state,
    t,
  ]);

  return { handleCheckFriendTag, handleSaveFriendship };
}
