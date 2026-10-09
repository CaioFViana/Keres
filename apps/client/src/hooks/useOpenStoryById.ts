import { StackActions, useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { useNotificationStore } from '../state/notificationStore';
import { useStoryStore } from '../state/storyStore';
import { useTheme } from '../theme';

/**
 * Opens a story that lives on this device from anywhere in the app, the way picking it in the story list
 * does. A story that is not here (not downloaded yet, or deleted) is said so, not opened empty.
 */
export function useOpenStoryById() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const db = useDrizzle();
  const { setTheme } = useTheme();
  const { showNotification } = useNotificationStore();

  return useCallback(
    async (storyId: string) => {
      const story = await db.query.stories.findFirst({
        where: (row, { eq }) => eq(row.id, storyId),
      });
      if (!story || story.isDeleted) {
        showNotification(t('friend_shared_unavailable'), 'warning');
        return;
      }
      useStoryStore.getState().setSelectedStory(story as never);
      setTheme(story.theme || 'default');
      // The action goes up from the nested stack to the one that holds the story's screens.
      navigation.dispatch(StackActions.replace('MainSystem', { storyId }));
    },
    [db, navigation, setTheme, showNotification, t],
  );
}
