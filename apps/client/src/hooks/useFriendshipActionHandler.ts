import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerSelect } from '../db/schema';
import { useNotificationStore } from '../state/notificationStore';
import { AppAlert } from '../utils/AppAlert';

export interface FriendshipActionOptions {
  /**
   * Ask first. On by default; off for what is harmless to do by mistake (accepting, declining or
   * withdrawing a request, unblocking), where a dialog is only a second tap to get through.
   */
  confirm?: boolean;
}

/**
 * Shared "confirm, call the API, refresh" wrapper behind every friendship status transition
 * (accept/decline/cancel/unfriend/blacklist/unblacklist) - used by both `FriendshipListScreen`
 * and `FriendDetailScreen` so the confirm-dialog/notification/error-handling shape stays in one
 * place instead of being copy-pasted per screen.
 */
export function useFriendshipActionHandler(
  getServerForFriendship: (serverId: string) => ServerSelect | undefined,
  onSuccess: () => void,
) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();

  return useCallback(
    (
      action: (friendshipId: string, currentUsersServerId: string) => Promise<void>,
      confirmationTitle: string,
      confirmationMessage: string,
      successMessage: string,
      errorMessage: string,
      { confirm = true }: FriendshipActionOptions = {},
    ) =>
      (friendshipId: string, serverId: string) => {
        const perform = async () => {
          try {
            const server = getServerForFriendship(serverId);
            const currentUsersServerId = server?.idUser;
            if (!currentUsersServerId) {
              showNotification(t('not_logged_in_to_server'), 'error');
              return;
            }
            await action(friendshipId, currentUsersServerId);
            showNotification(successMessage, 'success');
            onSuccess();
          } catch (error) {
            console.error(`Error during friendship action (ID: ${friendshipId}):`, error);
            showNotification(errorMessage, 'error');
          }
        };

        if (!confirm) {
          void perform();
          return;
        }
        AppAlert.alert(
          confirmationTitle,
          confirmationMessage,
          [
            { text: t('cancel'), style: 'cancel' },
            { text: t('proceed'), onPress: perform },
          ],
          { cancelable: true },
        );
      },
    [t, showNotification, getServerForFriendship, onSuccess],
  );
}
