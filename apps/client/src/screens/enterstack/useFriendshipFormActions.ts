import { FriendStatus } from '@keres/shared/metadata/FriendStatus';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { FriendshipStackParamList } from '../../navigation/StorySelectionStack';
import { friendshipApiService } from '../../services/FriendshipApiService';
import type { FriendshipService } from '../../services/FriendshipService';
import { userApiService } from '../../services/UserApiService';
import { AppAlert } from '../../utils/AppAlert';
import type { FriendshipFormState } from './useFriendshipFormState';

type FriendshipNavigation = NativeStackNavigationProp<FriendshipStackParamList, 'FriendshipList'>;

type UseFriendshipFormActionsOptions = {
  state: FriendshipFormState;
  friendshipServiceRef: RefObject<FriendshipService | null>;
  navigation: FriendshipNavigation;
  currentUserId?: string | null;
};

/** Owns validation, friend-tag lookup, persistence and navigation for the Friendship form. */
export function useFriendshipFormActions({
  state,
  friendshipServiceRef,
  navigation,
  currentUserId,
}: UseFriendshipFormActionsOptions) {
  const { t } = useTranslation();

  const handleCheckFriendTag = useCallback(async () => {
    if (!state.friendTag || state.friendTag.trim().length < 3) {
      AppAlert.alert(t('error'), t('invalid_friend_id_format'));
      state.setFriendUsername(null);
      state.setFriendFound(null);
      return;
    }

    if (!state.selectedServer) {
      AppAlert.alert(t('error'), t('selected_server_invalid'));
      return;
    }

    state.setIsCheckingFriend(true);
    state.setFriendFound(null);
    state.setFriendUsername(null);
    state.setResolvedFriendUserId(null);
    try {
      const userDetails = await userApiService.getUserByTag(
        state.selectedServer,
        state.friendTag.trim(),
      );
      if (userDetails) {
        state.setFriendUsername(userDetails.username);
        state.setResolvedFriendUserId(userDetails.id);
        state.setFriendFound(true);
        AppAlert.alert(
          t('success'),
          t('user_found_with_username', { username: userDetails.username }),
        );
      } else {
        state.setFriendFound(false);
        AppAlert.alert(t('error'), t('user_not_found_on_server'));
      }
    } catch (error) {
      console.error('Error checking friend tag:', error);
      AppAlert.alert(t('error'), t('failed_to_check_user_id'));
      state.setFriendFound(false);
    } finally {
      state.setIsCheckingFriend(false);
    }
  }, [state, t]);

  const handleSaveFriendship = useCallback(async () => {
    if (!currentUserId) {
      AppAlert.alert(t('error'), t('not_logged_in'));
      return;
    }
    if (!state.resolvedFriendUserId || !state.selectedServerId) {
      AppAlert.alert(t('error'), t('all_fields_required'));
      return;
    }
    if (state.friendFound === false) {
      AppAlert.alert(t('error'), t('friend_not_found_on_server'));
      return;
    }
    if (!state.friendUsername) {
      AppAlert.alert(t('error'), t('please_check_friend_id'));
      return;
    }
    if (!state.selectedServer || !state.selectedServer.idUser) {
      AppAlert.alert(t('error'), t('selected_server_invalid'));
      return;
    }
    if (!friendshipServiceRef.current) {
      AppAlert.alert(t('error'), t('failed_to_save_friendship'));
      return;
    }

    try {
      const currentUserServerId = state.selectedServer.idUser;

      // Compare per-server IDs, not the local app-installation currentUserId.
      if (state.resolvedFriendUserId === currentUserServerId) {
        AppAlert.alert(t('error'), t('cannot_friend_self'));
        return;
      }

      // Server first so a rejected request never leaves an orphaned local PENDING row.
      await friendshipApiService.sendFriendRequest(
        state.selectedServer,
        state.resolvedFriendUserId,
      );

      await friendshipServiceRef.current.addFriendship({
        senderId: currentUserServerId,
        receiverId: state.resolvedFriendUserId,
        serverId: state.selectedServerId,
        status: FriendStatus.PENDING,
        friendUsername: state.friendUsername,
      });

      AppAlert.alert(t('success'), t('friendship_added_successfully'));
      navigation.goBack();
    } catch (error) {
      console.error('Error saving friendship:', error);
      AppAlert.alert(t('error'), t('failed_to_save_friendship'));
    }
  }, [currentUserId, friendshipServiceRef, navigation, state, t]);

  return { handleCheckFriendTag, handleSaveFriendship };
}
