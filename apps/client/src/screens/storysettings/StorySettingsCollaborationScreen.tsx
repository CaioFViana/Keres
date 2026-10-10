import { Button } from '@/src/components/common';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import StoryCollaborationSection from '@/src/components/features/story/StoryCollaborationSection/StoryCollaborationSection';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryRole } from '../../hooks/useStoryRole';
import { useStoryStore } from '../../state/storyStore';
import { useLoadedStory } from './useLoadedStory';
import { useResetToStorySelection } from './useResetToStorySelection';
import { useStorySettingsSave } from './useStorySettingsSave';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

/**
 * Linking the story to a server and its people. Sending, inviting and leaving act at once; the one setting
 * kept on the story itself (whether readers may comment) is what this section's save writes.
 */
const StorySettingsCollaborationScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const navigation = useNavigation();
  const storyId = useStoryStore((state) => state.selectedStory?.id);
  const { canEdit, canManageStoryPolicy } = useStoryRole(storyId);
  const { saving, save } = useStorySettingsSave();
  const resetToStorySelection = useResetToStorySelection();
  const [allowReaderComments, setAllowReaderComments] = useState(false);

  useScreenHeader({ target: 'parent', title: t('story_settings_section_collaboration') });

  const { loading, error } = useLoadedStory(
    useCallback((story) => setAllowReaderComments(story.allowReaderComments), []),
  );

  if (!storyId) {
    return (
      <ScreenError
        message={t('no_story_selected_for_settings')}
        onGoBack={() => navigation.goBack()}
      />
    );
  }
  if (loading) return <ScreenLoading />;
  if (error) return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;

  return (
    <EntityFormContainer
      planUsage={false}
      title={t('story_settings_section_collaboration')}
      description={t('story_settings_section_collaboration_description')}
      actions={
        <Button
          onPress={() => void save({ allowReaderComments })}
          disabled={!canManageStoryPolicy || saving}
        >
          {t('update_story')}
        </Button>
      }
    >
      {canEdit && !canManageStoryPolicy && (
        <ThemedText tone="secondary" style={{ marginBottom: 15 }}>
          {t('story_owner_only_error')}
        </ThemedText>
      )}
      <StoryCollaborationSection
        storyId={storyId}
        allowReaderComments={allowReaderComments}
        onAllowReaderCommentsChange={setAllowReaderComments}
        canManageStoryPolicy={canManageStoryPolicy}
        onLeftStory={resetToStorySelection}
      />
    </EntityFormContainer>
  );
};

export default StorySettingsCollaborationScreen;
