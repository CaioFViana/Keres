import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ServerSelect } from '../db/schema';
import { useNotificationStore } from '../state/notificationStore';
import { AppAlert } from '../utils/AppAlert';

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
    ) =>
      (friendshipId: string, serverId: string) => {
        AppAlert.alert(
          confirmationTitle,
          confirmationMessage,
          [
            { text: t('cancel'), style: 'cancel' },
            {
              text: t('proceed'),
              onPress: async () => {
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
              },
            },
          ],
          { cancelable: true },
        );
      },
    [t, showNotification, getServerForFriendship, onSuccess],
  );
}
