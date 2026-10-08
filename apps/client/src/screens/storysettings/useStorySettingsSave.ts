import type { Story } from '@keres/shared/entities/Story';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../../db';
import { useAsyncOperation } from '../../hooks/useAsyncOperation';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { AppAlert } from '../../utils/AppAlert';

export type StoryFieldsPatch = Partial<
  Omit<Story, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'>
>;

/**
 * Each settings section saves only its own fields: the patch it hands over is all that is written, so one
 * section never overwrites what another changed. Reports the outcome and returns to the section list.
 */
export function useStorySettingsSave() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const drizzleDb = useDrizzle();
  const { userId } = useUserSettingsStore();
  const { selectedStory, setSelectedStory } = useStoryStore();
  const { pending: saving, run } = useAsyncOperation();
  const storyService = useMemo(() => createStoryService(drizzleDb), [drizzleDb]);

  const save = useCallback(
    (patch: StoryFieldsPatch) =>
      run(async () => {
        const storyId = selectedStory?.id;
        if (!storyId) return;
        if (!userId) {
          AppAlert.alert(t('error'), t('user_not_identified'));
          return;
        }
        try {
          await storyService.updateStory(userId, storyId, patch);
          setSelectedStory({ ...selectedStory, ...patch });
          AppAlert.alert(t('success'), t('story_updated_successfully'));
          navigation.goBack();
        } catch (err) {
          console.error('Failed to save story settings:', err);
          AppAlert.alert(t('error'), t('failed_to_save_story_settings'));
        }
      }),
    [navigation, run, selectedStory, setSelectedStory, storyService, t, userId],
  );

  return { saving, save };
}
