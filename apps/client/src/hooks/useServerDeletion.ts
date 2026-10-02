import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { OwnedServerStory } from '../services/ServerService';
import { ServerHasOwnedStoriesError } from '../services/ServerService';
import { AppAlert } from '../utils/AppAlert';

/** What the deletion needs of the service that stores the servers locally. */
interface ServerStore {
  getOwnedStories: (serverId: string) => Promise<OwnedServerStory[]>;
  deleteServer: (serverId: string) => Promise<unknown>;
}

/**
 * Removing a server from this device: refused while the user still owns stories on it (they would
 * be left with nowhere to sync), confirmed otherwise. `onDeleted` runs once it is gone.
 */
export function useServerDeletion(store: ServerStore, onDeleted: (serverId: string) => void) {
  const { t } = useTranslation();

  const showOwnedStoriesBlock = useCallback(
    (ownedStories: OwnedServerStory[]) => {
      AppAlert.alert(
        t('cannot_delete_server_owned_stories_title'),
        t('cannot_delete_server_owned_stories_message', {
          stories: ownedStories.map((story) => story.title).join(', '),
        }),
      );
    },
    [t],
  );

  return useCallback(
    async (serverId: string) => {
      try {
        const ownedStories = await store.getOwnedStories(serverId);
        if (ownedStories.length > 0) {
          showOwnedStoriesBlock(ownedStories);
          return;
        }
      } catch (err) {
        console.error('Failed to check stories before deleting server:', err);
        AppAlert.alert(t('error'), t('failed_to_delete_server'));
        return;
      }

      AppAlert.alert(
        t('delete_server_title'),
        t('delete_server_message'),
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: t('delete'),
            onPress: async () => {
              try {
                await store.deleteServer(serverId);
                onDeleted(serverId);
                AppAlert.alert(t('success'), t('server_deleted_successfully'));
              } catch (err) {
                console.error('Failed to delete server:', err);
                if (err instanceof ServerHasOwnedStoriesError) {
                  showOwnedStoriesBlock(err.ownedStories);
                } else {
                  AppAlert.alert(t('error'), t('failed_to_delete_server'));
                }
              }
            },
            style: 'destructive',
          },
        ],
        { cancelable: true },
      );
    },
    [store, onDeleted, showOwnedStoriesBlock, t],
  );
}
